# 05-live-data-backend-weather-restaurants-events.md

## Purpose
Implement a backend “live data” module that can produce compact weather + restaurants + events summaries for a given city/lat/lon.

This module is designed to be used by the chat endpoint to inject `live_data` into the system prompt.

## Pre-checks
1. Existing backend has:
   - `backend/app/api/api_v1/endpoints/chat.py`
   - `backend/app/core/rag.py`
   - `backend/app/core/prompts/persona.py`
2. There is currently no `live_data` module.
3. Your environment may or may not have internet access:
   - Use robust try/catch and provide deterministic fallback content.

## Implementation
### 1) Create a new backend module (required)
1. Add file: `backend/app/core/live_data.py`
2. Provide these functions (minimum set):
   - `def fetch_weather(city: str, latitude: float | None, longitude: float | None) -> dict`
   - `def fetch_restaurants(city: str, latitude: float | None, longitude: float | None) -> list[dict]`
   - `def fetch_events(city: str, latitude: float | None, longitude: float | None) -> list[dict]`
   - `def format_live_data_for_prompt(city: str, weather: dict | None, restaurants: list[dict] | None, events: list[dict] | None) -> str`
3. Add a small in-memory cache (recommended):
   - Keyed by `(city, rounded_lat, rounded_lon)`
   - TTL ~ 5 to 15 minutes

### 2) Weather (required)
4. Use a no-key weather API:
   - Recommended: Open-Meteo current weather endpoint
   - Example logic (pseudo):
     - If lat/lon exists: call Open-Meteo with coordinates
     - Else: attempt city lookup only if you already have a way (otherwise fallback)
5. Parse and return:
   - `temperature_c` (or similar)
   - `weather_code` (or a friendly description if available)
   - `wind_kph` (or similar) if returned
6. Fallback:
   - If any error occurs, return:
     - `{"source":"fallback","summary":"Weather unavailable right now"}` (keep it concise)

### 3) Restaurants (required)
7. Recommend restaurants near the user:
   - Use Overpass API or a fallback static list.
8. Overpass approach (best-effort):
   - If lat/lon exists, run an Overpass query for `amenity=restaurant` in a radius (e.g. 2000m)
   - Extract name + (optional) cuisine/tag if present
9. Parse to a structured list:
   - Each restaurant item: `{ "name": str, "cuisine": str | None }`
10. Fallback:
   - Return a small hardcoded list for each supported city (at least Tangier; others can be minimal).

### 4) Events (required as stub)
11. Implement `fetch_events` as a stub dataset (no external event feed dependency):
   - Use a dict in the module:
     - `EVENTS_BY_CITY = { "Tangier": [...], "Marrakech": [...], ... }`
   - Each item: `{ "title": str, "when": str | None, "note": str }`
12. For unknown cities, return an empty list (and let formatter say “No events data available”).

### 5) Prompt formatter (required)
13. Implement `format_live_data_for_prompt` to output a compact block string:
   - Keep it short for token efficiency.
   - Example format:
     - `Weather: <one line>`
     - `Restaurants: <3 names max>`
     - `Events: <up to 2 items max>`
14. The formatter must be safe with `None` inputs:
   - If weather is None, restaurants is empty, events empty: return something like:
     - `"Live data unavailable at the moment."`

## Verification (hard gates)
1. Import test:
   - `python -c "from app.core.live_data import format_live_data_for_prompt; print(format_live_data_for_prompt('Tangier', None, [], []))"`
2. Deterministic fallback:
   - If network calls fail, function still returns a non-empty string (or a known fallback string).
3. Output length:
   - Ensure the formatted string is short (target < 500 characters).

## Risk notes
- External APIs can be slow; consider adding timeouts to `requests` calls (e.g., 5–10s).
- If user is far from the city center or lat/lon missing, prefer fallback without failing.
