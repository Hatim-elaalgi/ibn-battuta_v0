"""
Place model — the catalogue table.

Pre-dimensioned with all the fields we'll need for the itinerary generator
(image_url, tags, hidden_gem, must_see, price_tier, best_time_of_day) so we
don't migrate twice.
"""
from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Place(Base):
    __tablename__ = "places"

    id:                Mapped[int]     = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    slug:              Mapped[str]     = mapped_column(String(120), unique=True, index=True, nullable=False)

    # Names
    name:              Mapped[str]     = mapped_column(String(200), nullable=False)
    name_ar:           Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Geography
    city:              Mapped[str]     = mapped_column(String(80), nullable=False, index=True)
    region:            Mapped[str | None] = mapped_column(String(80), nullable=True, default="Tanger-Tetouan-Al Hoceima")
    lat:               Mapped[float]   = mapped_column(Float, nullable=False)
    lon:               Mapped[float]   = mapped_column(Float, nullable=False)

    # Classification
    type:              Mapped[str]     = mapped_column(String(40), nullable=False, index=True)
    subtype:           Mapped[str | None] = mapped_column(String(60), nullable=True)
    tags:              Mapped[list]    = mapped_column(JSON, nullable=False, default=list)

    # Editorial
    short_desc:        Mapped[str | None] = mapped_column(String(300), nullable=True)
    description:       Mapped[str | None] = mapped_column(Text, nullable=True)
    emoji:             Mapped[str | None] = mapped_column(String(8), nullable=True)
    image_url:         Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Curation flags
    hidden_gem:        Mapped[bool]    = mapped_column(Boolean, nullable=False, default=False, index=True)
    must_see:          Mapped[bool]    = mapped_column(Boolean, nullable=False, default=False, index=True)

    # Visit hints
    avg_visit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True, default=60)
    price_tier:        Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0 free / 1 cheap / 2 mid / 3 high
    best_time_of_day:  Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Audit
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_places_city_type", "city", "type"),
    )

    def __repr__(self) -> str:
        return f"<Place {self.id} {self.slug!r} ({self.city})>"
