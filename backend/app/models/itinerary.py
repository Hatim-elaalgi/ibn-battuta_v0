"""
Itinerary skeleton models — schema only, Phase 2 fills them.
"""
from datetime import date, datetime
from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Itinerary(Base):
    __tablename__ = "itineraries"

    id:               Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    edit_token:       Mapped[str]      = mapped_column(String(40), unique=True, index=True, nullable=False)
    view_token:       Mapped[str]      = mapped_column(String(40), unique=True, index=True, nullable=False)

    title:            Mapped[str]      = mapped_column(String(200), nullable=False)
    start_city:       Mapped[str]      = mapped_column(String(80), nullable=False)
    start_date:       Mapped[date | None] = mapped_column(Date, nullable=True)
    num_days:         Mapped[int]      = mapped_column(Integer, nullable=False)
    traveler_profile: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status:           Mapped[str]      = mapped_column(String(20), nullable=False, default="draft")

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    days: Mapped[list["ItineraryDay"]] = relationship(
        back_populates="itinerary",
        cascade="all, delete-orphan",
        order_by="ItineraryDay.day_number",
    )


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    itinerary_id:  Mapped[int]      = mapped_column(ForeignKey("itineraries.id", ondelete="CASCADE"), index=True, nullable=False)
    day_number:    Mapped[int]      = mapped_column(Integer, nullable=False)
    date:          Mapped[date | None] = mapped_column(Date, nullable=True)
    city:          Mapped[str]      = mapped_column(String(80), nullable=False)
    theme:         Mapped[str | None] = mapped_column(String(120), nullable=True)
    summary:       Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    itinerary: Mapped[Itinerary] = relationship(back_populates="days")
    stops: Mapped[list["ItineraryStop"]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        order_by="ItineraryStop.order_index",
    )


class ItineraryStop(Base):
    __tablename__ = "itinerary_stops"

    id:               Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    day_id:           Mapped[int]      = mapped_column(ForeignKey("itinerary_days.id", ondelete="CASCADE"), index=True, nullable=False)
    place_id:         Mapped[int | None] = mapped_column(ForeignKey("places.id"), index=True, nullable=True)

    order_index:      Mapped[int]      = mapped_column(Integer, nullable=False)
    start_time:       Mapped[str | None] = mapped_column(String(8), nullable=True)   # "HH:MM:SS"
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes:            Mapped[str | None] = mapped_column(Text, nullable=True)

    # Free-form stop (when place_id is null)
    custom_name:      Mapped[str | None] = mapped_column(String(200), nullable=True)
    custom_lat:       Mapped[float | None] = mapped_column(Float, nullable=True)
    custom_lon:       Mapped[float | None] = mapped_column(Float, nullable=True)

    day: Mapped[ItineraryDay] = relationship(back_populates="stops")
