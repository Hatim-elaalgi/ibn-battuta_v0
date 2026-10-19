"""
Pydantic DTOs for the `itineraries` endpoints.

Phase 1 — these match the stub response. Phase 2 will wire the same shapes
to real DB rows + LLM-generated content.
"""
from typing import Optional

from pydantic import BaseModel


# ── Request bodies ─────────────────────────────────────────────────────────
class ItineraryGenerateRequest(BaseModel):
    city:       str            = "Tangier"
    num_days:   int            = 3
    interests:  list[str]      = []
    party_size: Optional[int]  = 2
    pace:       Optional[str]  = "balanced"   # 'slow' | 'balanced' | 'packed'
    budget_tier: Optional[str] = "mid"        # 'budget' | 'mid' | 'splurge'
    notes:      Optional[str]  = ""           # free-text traveller notes


# ── Response shapes ────────────────────────────────────────────────────────
class StopRead(BaseModel):
    order_index:      int
    name:             str
    lat:              Optional[float] = None
    lon:              Optional[float] = None
    start_time:       Optional[str]   = None
    duration_minutes: Optional[int]   = None
    notes:            Optional[str]   = None
    place_id:         Optional[int]   = None
    emoji:            Optional[str]   = None


class DayRead(BaseModel):
    day_number: int
    city:       str
    theme:      Optional[str] = None
    summary:    Optional[str] = None
    stops:      list[StopRead]


class ItineraryRead(BaseModel):
    edit_token: str
    view_token: str
    title:      str
    start_city: str
    num_days:   int
    days:       list[DayRead]
    status:     str = "draft"
