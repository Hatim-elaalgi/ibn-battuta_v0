import asyncio
import json
import logging
import queue as tqueue
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from app.core.prompts.persona import IBN_BATTUTA_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT
from app.core.rag import query_knowledge
from app.core.llm import call_local_llm, call_local_llm_with_image, call_local_llm_streaming
from app.core.location import derive_city_from_latlon
from app.core.live_data import get_live_data_block

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    image_data: Optional[str] = None  # Base64 encoded image
    history: Optional[List[dict]] = []  # For future conversation history support
    latitude: Optional[float] = None   # GPS latitude from browser
    longitude: Optional[float] = None  # GPS longitude from browser
    city: Optional[str] = None         # Explicit city override

class ChatResponse(BaseModel):
    response: str
    city: Optional[str] = None         # Resolved city name (for frontend badge)
    live: Optional[dict] = None        # Structured live data (for frontend cards)


# ── Shared context-building logic ──────────────────────────────────────────
async def _build_context(request: ChatRequest):
    """Resolve city, fetch live data, build RAG context and system prompt."""
    user_msg   = request.message or ""
    image_data = request.image_data

    if request.city:
        resolved_city = request.city
    elif request.latitude is not None and request.longitude is not None:
        resolved_city = derive_city_from_latlon(request.latitude, request.longitude)
    else:
        resolved_city = ""

    live_data_block = ""
    live_structured: Optional[dict] = None
    if resolved_city or request.latitude is not None:
        live_data_block, live_structured = get_live_data_block(
            resolved_city, request.latitude, request.longitude
        )

    if image_data:
        context = ""
    elif user_msg.strip():
        context = query_knowledge(user_msg, city=resolved_city or None)
    else:
        context = ""

    template = VISION_SYSTEM_PROMPT if image_data else IBN_BATTUTA_SYSTEM_PROMPT
    system_prompt = template.format(
        context=context or "No specific context found.",
        city=resolved_city or "",
        live_data=live_data_block or "",
    )
    return user_msg, image_data, resolved_city, live_structured, system_prompt


@router.post("/chat", response_model=ChatResponse)
async def chat_with_guide(request: ChatRequest):
    """Non-streaming chat. Returns full response as JSON."""
    try:
        user_msg, image_data, resolved_city, live_structured, system_prompt = \
            await _build_context(request)

        if image_data:
            ai_response = call_local_llm_with_image(
                user_message=user_msg or "What can you see in this image?",
                image_data=image_data,
                system_prompt=system_prompt,
            )
        else:
            ai_response = call_local_llm(user_message=user_msg, system_prompt=system_prompt)

        return ChatResponse(
            response=ai_response,
            city=resolved_city or None,
            live=live_structured or None,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming chat via Server-Sent Events.
    Emits:
      data: {"type":"meta",  "city":"...", "live":{...}}   — first event
      data: {"type":"chunk", "text":"..."}                  — one per LLM token
      data: {"type":"done",  "full":"..."}                  — final event
    Vision requests fall back to the non-streaming path (single chunk).
    """
    try:
        user_msg, image_data, resolved_city, live_structured, system_prompt = \
            await _build_context(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    async def generate():
        loop = asyncio.get_running_loop()

        # 1. Meta event — city + live data arrive immediately
        meta = {"type": "meta", "city": resolved_city or None, "live": live_structured or None}
        yield f"data: {json.dumps(meta)}\n\n"

        full_text = ""

        if image_data:
            # Vision has no token streaming — run blocking call in thread
            try:
                ai_response = await loop.run_in_executor(
                    None,
                    lambda: call_local_llm_with_image(
                        user_message=user_msg or "What can you see in this image?",
                        image_data=image_data,
                        system_prompt=system_prompt,
                    )
                )
                full_text = ai_response
                yield f"data: {json.dumps({'type': 'chunk', 'text': ai_response})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        else:
            # Text: run the synchronous LM-Studio SSE consumer in a background thread
            # and pipe chunks back via a thread-safe queue polled by the async loop.
            sync_q: tqueue.Queue = tqueue.Queue()

            def _stream_worker():
                try:
                    for chunk in call_local_llm_streaming(user_msg, system_prompt):
                        sync_q.put(chunk)
                except Exception as exc:
                    sync_q.put(exc)
                finally:
                    sync_q.put(None)  # sentinel

            threading.Thread(target=_stream_worker, daemon=True).start()

            # Poll the thread-safe queue; yield to the event loop between polls
            while True:
                try:
                    item = sync_q.get_nowait()
                except tqueue.Empty:
                    await asyncio.sleep(0.005)
                    continue

                if item is None:
                    break
                if isinstance(item, Exception):
                    yield f"data: {json.dumps({'type': 'error', 'message': str(item)})}\n\n"
                    break
                full_text += item
                yield f"data: {json.dumps({'type': 'chunk', 'text': item})}\n\n"

        # 2. Done event — full assembled text for any post-processing
        yield f"data: {json.dumps({'type': 'done', 'full': full_text})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
