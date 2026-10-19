import logging
from typing import Optional

import edge_tts
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# Neural voices for Ibn Battuta persona (male, authoritative)
VOICE_MAP: dict[str, str] = {
    "en":    "en-GB-RyanNeural",        # British English — scholarly tone
    "en-us": "en-US-ChristopherNeural",
    "en-gb": "en-GB-RyanNeural",
    "fr":    "fr-FR-HenriNeural",       # Natural French male
    "fr-fr": "fr-FR-HenriNeural",
}
DEFAULT_VOICE = "en-GB-RyanNeural"
MAX_TEXT_LENGTH = 1500


class TtsRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    voice: Optional[str] = None   # explicit voice name override
    rate: Optional[str] = "-5%"   # slightly slower for gravitas
    pitch: Optional[str] = "-2Hz" # slightly deeper


@router.post("/tts")
async def text_to_speech(request: TtsRequest):
    """
    Convert text to MP3 audio using Microsoft Edge neural TTS voices.
    Returns audio/mpeg bytes for direct playback in the browser.
    """
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]

    lang = (request.language or "en").lower()
    voice = request.voice or VOICE_MAP.get(lang, DEFAULT_VOICE)

    logger.info(f"TTS: voice={voice}, len={len(text)}")

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=request.rate or "-5%",
            pitch=request.pitch or "-2Hz",
        )

        audio_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        audio_data = b"".join(audio_chunks)
        if not audio_data:
            raise HTTPException(status_code=500, detail="TTS produced empty audio")

        logger.info(f"TTS OK — {len(audio_data)} bytes")
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={"Content-Disposition": 'inline; filename="speech.mp3"'},
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"TTS synthesis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}")
