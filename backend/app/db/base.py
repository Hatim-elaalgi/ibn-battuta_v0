"""
Declarative Base for all ORM models.

Importing the model modules from here ensures `Base.metadata` knows about every
table before `create_all()` is called from init_db.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Side-effect imports — register all models on Base.metadata.
# Order matters only for foreign-key resolution; SQLAlchemy resolves lazily.
from app.models import place, itinerary  # noqa: E402, F401
