"""
Data-access layer for `itineraries`, `itinerary_days`, `itinerary_stops`.

Tokens (edit_token, view_token) are short URL-safe strings generated with secrets.
Edit token grants full read/write; view token is read-only public.
"""
from __future__ import annotations

import logging
import secrets
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Itinerary, ItineraryDay, ItineraryStop, Place

logger = logging.getLogger(__name__)


# ── Token helpers ───────────────────────────────────────────────────────────
def _new_edit_token() -> str:
    return secrets.token_urlsafe(24)   # ~32 chars


def _new_view_token() -> str:
    return secrets.token_urlsafe(12)   # ~16 chars


# ── Persist a freshly-generated itinerary ───────────────────────────────────
def persist_generated(db: Session, *, generated: dict, profile: dict) -> Itinerary:
    """
    `generated` is the dict returned by services.itinerary_generator.generate_itinerary.
    `profile` is the original traveller profile (preferences + notes) — stored as JSON.
    """
    it = Itinerary(
        edit_token       = _new_edit_token(),
        view_token       = _new_view_token(),
        title            = generated["title"],
        start_city       = generated["start_city"],
        num_days         = generated["num_days"],
        traveler_profile = profile,
        status           = "draft",
    )

    for d in generated["days"]:
        day = ItineraryDay(
            day_number = d["day_number"],
            city       = d["city"],
            theme      = d.get("theme") or None,
            summary    = d.get("summary") or None,
        )
        for s in d.get("stops", []):
            day.stops.append(ItineraryStop(
                place_id         = s.get("place_id"),
                order_index      = s["order_index"],
                start_time       = s.get("start_time"),
                duration_minutes = s.get("duration_minutes"),
                notes            = s.get("narration") or None,   # narration → notes
                custom_name      = None if s.get("place_id") else s.get("name"),
                custom_lat       = None if s.get("place_id") else s.get("lat"),
                custom_lon       = None if s.get("place_id") else s.get("lon"),
            ))
        it.days.append(day)

    db.add(it)
    db.commit()
    db.refresh(it)
    return it


# ── Read by token ──────────────────────────────────────────────────────────
def get_by_edit_token(db: Session, token: str) -> Optional[Itinerary]:
    return _get_by_token(db, Itinerary.edit_token, token)


def get_by_view_token(db: Session, token: str) -> Optional[Itinerary]:
    return _get_by_token(db, Itinerary.view_token, token)


def _get_by_token(db: Session, column, token: str) -> Optional[Itinerary]:
    stmt = (
        select(Itinerary)
        .where(column == token)
        .options(
            selectinload(Itinerary.days).selectinload(ItineraryDay.stops),
        )
    )
    return db.execute(stmt).scalar_one_or_none()


# ── Hydrate Place lookup so we can serialise stops with name/lat/lon ───────
def hydrate_places(db: Session, itinerary: Itinerary) -> dict[int, Place]:
    place_ids = {s.place_id for d in itinerary.days for s in d.stops if s.place_id}
    if not place_ids:
        return {}
    rows = db.query(Place).filter(Place.id.in_(place_ids)).all()
    return {p.id: p for p in rows}


# ── Granular patches (all return the updated row) ──────────────────────────
def update_itinerary_meta(db: Session, it: Itinerary, *, title: Optional[str] = None) -> Itinerary:
    if title is not None:
        it.title = title.strip() or it.title
    db.commit()
    db.refresh(it)
    return it


def update_day(db: Session, it: Itinerary, day_number: int, *,
               theme: Optional[str] = None, summary: Optional[str] = None) -> Optional[ItineraryDay]:
    day = next((d for d in it.days if d.day_number == day_number), None)
    if not day:
        return None
    if theme   is not None: day.theme   = theme.strip() or None
    if summary is not None: day.summary = summary.strip() or None
    db.commit()
    db.refresh(day)
    return day


def update_stop(db: Session, it: Itinerary, stop_id: int, *,
                start_time: Optional[str] = None,
                duration_minutes: Optional[int] = None,
                notes: Optional[str] = None,
                order_index: Optional[int] = None) -> Optional[ItineraryStop]:
    stop = (
        db.query(ItineraryStop)
          .join(ItineraryDay, ItineraryStop.day_id == ItineraryDay.id)
          .filter(ItineraryStop.id == stop_id, ItineraryDay.itinerary_id == it.id)
          .first()
    )
    if not stop:
        return None
    if start_time       is not None: stop.start_time       = start_time
    if duration_minutes is not None: stop.duration_minutes = int(duration_minutes)
    if notes            is not None: stop.notes            = notes
    if order_index      is not None: stop.order_index      = int(order_index)
    db.commit()
    db.refresh(stop)
    return stop


def reorder_day_stops(db: Session, it: Itinerary, day_number: int, ordered_stop_ids: list[int]) -> bool:
    day = next((d for d in it.days if d.day_number == day_number), None)
    if not day:
        return False
    by_id = {s.id: s for s in day.stops}
    for new_idx, sid in enumerate(ordered_stop_ids):
        if sid in by_id:
            by_id[sid].order_index = new_idx
    db.commit()
    return True


def delete_stop(db: Session, it: Itinerary, stop_id: int) -> bool:
    stop = (
        db.query(ItineraryStop)
          .join(ItineraryDay, ItineraryStop.day_id == ItineraryDay.id)
          .filter(ItineraryStop.id == stop_id, ItineraryDay.itinerary_id == it.id)
          .first()
    )
    if not stop:
        return False
    db.delete(stop)
    db.commit()
    return True


def add_stop(db: Session, it: Itinerary, day_number: int, *,
             place_id: Optional[int] = None,
             custom_name: Optional[str] = None,
             custom_lat: Optional[float] = None,
             custom_lon: Optional[float] = None,
             start_time: Optional[str] = None,
             duration_minutes: Optional[int] = 60,
             notes: Optional[str] = None) -> Optional[ItineraryStop]:
    day = next((d for d in it.days if d.day_number == day_number), None)
    if not day:
        return None
    next_idx = max((s.order_index for s in day.stops), default=-1) + 1
    stop = ItineraryStop(
        day_id           = day.id,
        place_id         = place_id,
        order_index      = next_idx,
        start_time       = start_time,
        duration_minutes = duration_minutes,
        notes            = notes,
        custom_name      = custom_name if not place_id else None,
        custom_lat       = custom_lat  if not place_id else None,
        custom_lon       = custom_lon  if not place_id else None,
    )
    db.add(stop)
    db.commit()
    db.refresh(stop)
    return stop


# ── Serialise for frontend ─────────────────────────────────────────────────
def serialise(itinerary: Itinerary, places_by_id: dict[int, Place]) -> dict:
    return {
        "edit_token":       itinerary.edit_token,
        "view_token":       itinerary.view_token,
        "title":            itinerary.title,
        "start_city":       itinerary.start_city,
        "num_days":         itinerary.num_days,
        "status":           itinerary.status,
        "traveler_profile": itinerary.traveler_profile or {},
        "days": [
            {
                "id":         d.id,
                "day_number": d.day_number,
                "city":       d.city,
                "theme":      d.theme,
                "summary":    d.summary,
                "stops": [
                    _serialise_stop(s, places_by_id.get(s.place_id) if s.place_id else None)
                    for s in sorted(d.stops, key=lambda x: x.order_index)
                ],
            }
            for d in sorted(itinerary.days, key=lambda x: x.day_number)
        ],
    }


def _serialise_stop(stop: ItineraryStop, place: Optional[Place]) -> dict:
    return {
        "id":               stop.id,
        "order_index":      stop.order_index,
        "place_id":         stop.place_id,
        "name":             place.name if place else stop.custom_name,
        "emoji":            place.emoji if place else None,
        "city":             place.city  if place else None,
        "lat":              place.lat   if place else stop.custom_lat,
        "lon":              place.lon   if place else stop.custom_lon,
        "start_time":       stop.start_time,
        "duration_minutes": stop.duration_minutes,
        "notes":            stop.notes,
    }
