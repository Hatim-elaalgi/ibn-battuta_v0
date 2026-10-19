from fastapi import APIRouter
from app.api.api_v1.endpoints import health, chat, tts, places, itineraries

api_router = APIRouter()
api_router.include_router(health.router,      tags=["health"])
api_router.include_router(chat.router,        tags=["chat"])
api_router.include_router(tts.router,         tags=["tts"])
api_router.include_router(places.router,      prefix="/places",      tags=["places"])
api_router.include_router(itineraries.router, prefix="/itineraries", tags=["itineraries"])
