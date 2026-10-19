"""
Itineraries router — Phase 2.

POST   /itineraries/generate              — SSE: streams 3-pass LLM generation, persists to DB
GET    /itineraries/{token}               — read by edit_token (or view_token, fallback)
PATCH  /itineraries/{edit_token}          — granular updates (title, day, stop, reorder)
POST   /itineraries/{edit_token}/stops    — add a stop to a day
DELETE /itineraries/{edit_token}/stops/{stop_id}
POST   /itineraries/{edit_token}/regenerate-stop/{stop_id} — single-stop re-narration
"""
from __future__ import annotations

import asyncio
import json
import logging
import queue as tqueue
import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.crud import itinerary as crud
from app.db.session import SessionLocal, get_db
from app.models import Itinerary
from app.schemas.itinerary import ItineraryGenerateRequest
from app.services.itinerary_generator import generate_itinerary

logger = logging.getLogger(__name__)
router = APIRouter()


# ════════════════════════════════════════════════════════════════════════════
# POST /generate — SSE streaming
# ════════════════════════════════════════════════════════════════════════════
@router.post("/generate")
async def generate(req: ItineraryGenerateRequest):
    """
    Server-Sent Events stream. The pipeline runs in a worker thread and pushes
    progress events into a queue that the async generator drains.

    Events:
      data: {"type":"phase","phase":"plan|select|narrate","label":"...","day":<n>}
      data: {"type":"plan_ready","title":"...","days":[...]}
      data: {"type":"day_stops_ready","day":<n>,"city":"...","stops":[...]}
      data: {"type":"day_narration_ready","day":<n>,"summary":"...","stops":[...]}
      data: {"type":"persisted","edit_token":"...","view_token":"..."}
      data: {"type":"done"}
      data: {"type":"error","message":"..."}
    """
    sync_q: tqueue.Queue = tqueue.Queue()

    def push(event_type: str, payload: dict):
        sync_q.put({"type": event_type, **payload})

    def worker():
        db = SessionLocal()
        try:
            generated = generate_itinerary(
                db,
                start_city       = req.city or "Tangier",
                num_days         = req.num_days or 3,
                interests        = req.interests or [],
                party_size       = req.party_size or 2,
                pace             = req.pace or "balanced",
                budget           = req.budget_tier or "mid",
                notes            = req.notes or "",
                progress         = push,
            )
            it = crud.persist_generated(
                db,
                generated=generated,
                profile={
                    "city":        req.city,
                    "num_days":    req.num_days,
                    "interests":   req.interests,
                    "party_size":  req.party_size,
                    "pace":        req.pace,
                    "budget_tier": req.budget_tier,
                },
            )
            push("persisted", {"edit_token": it.edit_token, "view_token": it.view_token})
        except Exception as exc:
            logger.exception("Itinerary generation failed")
            push("error", {"message": str(exc)})
        finally:
            sync_q.put(None)   # sentinel
            db.close()

    threading.Thread(target=worker, daemon=True).start()

    async def sse():
        while True:
            try:
                item = sync_q.get_nowait()
            except tqueue.Empty:
                await asyncio.sleep(0.05)
                continue
            if item is None:
                yield f"data: {json.dumps({'type':'done'})}\n\n"
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ════════════════════════════════════════════════════════════════════════════
# GET /{token} — read by edit_token (or view_token fallback)
# ════════════════════════════════════════════════════════════════════════════
@router.get("/{token}")
def get_itinerary(token: str, db: Session = Depends(get_db)):
    it = crud.get_by_edit_token(db, token) or crud.get_by_view_token(db, token)
    if not it:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    places = crud.hydrate_places(db, it)
    return crud.serialise(it, places)


# ════════════════════════════════════════════════════════════════════════════
# PATCH /{edit_token} — granular updates
# ════════════════════════════════════════════════════════════════════════════
class StopPatch(BaseModel):
    id:               int
    start_time:       Optional[str]  = None
    duration_minutes: Optional[int]  = None
    notes:            Optional[str]  = None
    order_index:      Optional[int]  = None


class DayPatch(BaseModel):
    day_number: int
    theme:      Optional[str]            = None
    summary:    Optional[str]            = None
    reorder:    Optional[list[int]]      = None   # list of stop IDs in new order


class ItineraryPatch(BaseModel):
    title: Optional[str]              = None
    day:   Optional[DayPatch]         = None
    stop:  Optional[StopPatch]        = None


def _require_edit(db: Session, token: str) -> Itinerary:
    it = crud.get_by_edit_token(db, token)
    if not it:
        raise HTTPException(status_code=404, detail="Itinerary not found (or read-only token)")
    return it


@router.patch("/{edit_token}")
def patch_itinerary(edit_token: str, patch: ItineraryPatch, db: Session = Depends(get_db)):
    it = _require_edit(db, edit_token)

    if patch.title is not None:
        crud.update_itinerary_meta(db, it, title=patch.title)

    if patch.day:
        d = patch.day
        if d.theme is not None or d.summary is not None:
            crud.update_day(db, it, d.day_number, theme=d.theme, summary=d.summary)
        if d.reorder:
            crud.reorder_day_stops(db, it, d.day_number, d.reorder)

    if patch.stop:
        s = patch.stop
        crud.update_stop(
            db, it, s.id,
            start_time=s.start_time,
            duration_minutes=s.duration_minutes,
            notes=s.notes,
            order_index=s.order_index,
        )

    db.refresh(it)
    places = crud.hydrate_places(db, it)
    return crud.serialise(it, places)


# ════════════════════════════════════════════════════════════════════════════
# Add / delete stops
# ════════════════════════════════════════════════════════════════════════════
class AddStopRequest(BaseModel):
    day_number:       int
    place_id:         Optional[int]    = None
    custom_name:      Optional[str]    = None
    custom_lat:       Optional[float]  = None
    custom_lon:       Optional[float]  = None
    start_time:       Optional[str]    = None
    duration_minutes: Optional[int]    = 60
    notes:            Optional[str]    = None


@router.post("/{edit_token}/stops")
def add_stop(edit_token: str, body: AddStopRequest, db: Session = Depends(get_db)):
    it = _require_edit(db, edit_token)
    stop = crud.add_stop(
        db, it, body.day_number,
        place_id         = body.place_id,
        custom_name      = body.custom_name,
        custom_lat       = body.custom_lat,
        custom_lon       = body.custom_lon,
        start_time       = body.start_time,
        duration_minutes = body.duration_minutes,
        notes            = body.notes,
    )
    if not stop:
        raise HTTPException(status_code=400, detail="Day not found")
    db.refresh(it)
    places = crud.hydrate_places(db, it)
    return crud.serialise(it, places)


@router.delete("/{edit_token}/stops/{stop_id}")
def remove_stop(edit_token: str, stop_id: int, db: Session = Depends(get_db)):
    it = _require_edit(db, edit_token)
    if not crud.delete_stop(db, it, stop_id):
        raise HTTPException(status_code=404, detail="Stop not found")
    db.refresh(it)
    places = crud.hydrate_places(db, it)
    return crud.serialise(it, places)


# ════════════════════════════════════════════════════════════════════════════
# Regenerate a single stop's narration (Pass 3 for one stop)
# ════════════════════════════════════════════════════════════════════════════
@router.post("/{edit_token}/regenerate-stop/{stop_id}")
def regenerate_stop(edit_token: str, stop_id: int, db: Session = Depends(get_db)):
    from app.services.itinerary_generator import pass_narrate
    it = _require_edit(db, edit_token)

    stop = next((s for d in it.days for s in d.stops if s.id == stop_id), None)
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    day = next((d for d in it.days if any(s.id == stop_id for s in d.stops)), None)
    places = crud.hydrate_places(db, it)
    place = places.get(stop.place_id) if stop.place_id else None
    if not place:
        raise HTTPException(status_code=400, detail="Stop has no Place to narrate")

    fake_stop_dict = {
        "place_id":         stop.place_id,
        "start_time":       stop.start_time or "10:00",
        "duration_minutes": stop.duration_minutes or 60,
        "order_index":      0,
    }
    out = pass_narrate(
        day_number=day.day_number, city=day.city, theme=day.theme or "",
        stops_with_places=[(fake_stop_dict, place)],
    )
    if out.get("stops"):
        stop.notes = out["stops"][0].get("narration", stop.notes)
        db.commit()
        db.refresh(stop)

    db.refresh(it)
    return crud.serialise(it, places)
