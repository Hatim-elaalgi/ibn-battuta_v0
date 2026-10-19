"""
Pydantic DTOs for the `places` endpoints.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PlaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                int
    slug:              str
    name:              str
    name_ar:           Optional[str]   = None
    city:              str
    region:            Optional[str]   = None
    lat:               float
    lon:               float
    type:              str
    subtype:           Optional[str]   = None
    tags:              list[str]       = []
    short_desc:        Optional[str]   = None
    description:       Optional[str]   = None
    emoji:             Optional[str]   = None
    image_url:         Optional[str]   = None
    hidden_gem:        bool
    must_see:          bool
    avg_visit_minutes: Optional[int]   = None
    price_tier:        Optional[int]   = None
    best_time_of_day:  Optional[str]   = None
    created_at:        datetime
    updated_at:        datetime


class PlaceListResponse(BaseModel):
    total: int
    items: list[PlaceRead]
