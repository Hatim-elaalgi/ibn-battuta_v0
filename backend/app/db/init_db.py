"""
DB bootstrap — runs once on FastAPI startup via lifespan.

Creates tables (idempotent) and seeds the `places` table if empty.
"""
import logging

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.seed_places import seed_places_if_empty

logger = logging.getLogger(__name__)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        n = seed_places_if_empty(db)
        if n:
            logger.info("DB initialised with %d seed places", n)
        else:
            logger.info("DB already populated, skipping seed")
    finally:
        db.close()
