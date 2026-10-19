"""
SQLAlchemy engine + session factory.

The DB lives at backend/app.db (next to chroma_db/), resolved relative to the
process cwd, which is the `backend/` folder when running `uvicorn app.main:app`.
SQLite needs `check_same_thread=False` because FastAPI dispatches sync DB calls
across the threadpool.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency: yields a Session, closes it on request end."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
