"""
GET /places   — filterable list of curated places
GET /places/{id} — single place detail
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Place
from app.schemas.place import PlaceListResponse, PlaceRead

router = APIRouter()


@router.get("", response_model=PlaceListResponse)
def list_places(
    city:       Optional[str]  = Query(None,    description="Exact city name"),
    type:       Optional[str]  = Query(None,    description="culture|coast|nature|day_trip|..."),
    hidden_gem: Optional[bool] = Query(None),
    must_see:   Optional[bool] = Query(None),
    limit:      int            = Query(50, ge=1, le=200),
    offset:     int            = Query(0,  ge=0),
    db:         Session        = Depends(get_db),
):
    q = db.query(Place)
    if city is not None:        q = q.filter(Place.city == city)
    if type is not None:        q = q.filter(Place.type == type)
    if hidden_gem is not None:  q = q.filter(Place.hidden_gem == hidden_gem)
    if must_see   is not None:  q = q.filter(Place.must_see   == must_see)

    total = q.count()
    items = q.order_by(Place.must_see.desc(), Place.name).offset(offset).limit(limit).all()
    return {"total": total, "items": items}


@router.get("/{place_id}", response_model=PlaceRead)
def get_place(place_id: int, db: Session = Depends(get_db)):
    place = db.query(Place).filter(Place.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place
