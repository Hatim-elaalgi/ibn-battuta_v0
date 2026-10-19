# 03-gps-city-context-backend.md

## Purpose
Extend the FastAPI backend `/api/v1/chat` contract to accept optional GPS coordinates and a derived (or provided) city name, then pass `city` into the prompt template formatting.

At the end of this task:
- Existing calls without GPS still work.
- Vision (image) calls still work.
- Text-only calls still work.

## Pre-checks
1. Inspect current backend contract:
   - `backend/app/api/api_v1/endpoints/chat.py`
   - Current `ChatRequest` includes `message`, `image_data`, and `history` only.
2. Inspect current prompt formatting:
   - In `chat_with_guide`, `full_system_prompt` is produced via:
     - `system_prompt_template.format(context=...)`
   - Current `backend/app/core/prompts/persona.py` templates expect `{context}` only.
3. Confirm current behavior:
   - When `image_data` is present, RAG context is skipped (`context = ""`) to preserve tokens.

## Implementation
### 1) Update request/response models (required)
1. In `backend/app/api/api_v1/endpoints/chat.py`, update `ChatRequest`:
   - Add optional fields:
     - `latitude: Optional[float] = None`
     - `longitude: Optional[float] = None`
     - `city: Optional[str] = None`
2. Keep backward compatibility:
   - Calls that omit these fields must still deserialize.

### 2) Add server-side city derivation (required)
3. Create a small helper to derive city from lat/lon:
   - Preferred: add `backend/app/core/location.py`
   - Required function signature (suggested):
     - `def derive_city_from_latlon(latitude: float, longitude: float) -> str:`
4. Use a simple nearest-known-center approach for MVP+:
   - Maintain a mapping of known centers with approximate coordinates:
     - `Tangier`, `Marrakech`, `Casablanca`, `Paris`, `Cairo`
   - Use Haversine distance to select nearest.
5. Add a threshold:
   - If nearest city is farther than a configurable distance (e.g., 200km), return `"Unknown"` (or empty string).
6. If request includes `city` explicitly:
   - Trust it over derived coordinates.

### 3) Pass `city` into the prompt pipeline (required)
7. Update `chat_with_guide` in `chat.py`:
   - Determine `resolved_city`:
     - If `request.city` exists: use it
     - Else if both `latitude` and `longitude` exist: derive it
     - Else: `resolved_city = ""` (or `"Unknown"`)
8. Update prompt formatting call site to include `city`:
   - Because `persona.py` currently only uses `{context}`, you must align formatting with the next task:
     - For now, do one of the following to avoid breaking:
       - Option A (recommended): update formatting code to pass both `context` and `city` via `.format(context=..., city=resolved_city)`
       - Option B: if `.format()` would crash due to missing `{city}` in current templates, keep `.format(context=...)` for now and pass `city` only via a wrapper variable/logging.
   - This task should “wire `city` through” cleanly even if the prompt template will be updated in the next task.

### 4) Ensure behavior stays consistent
9. RAG behavior remains unchanged in this task:
   - Vision requests: still skip RAG context for tokens.
   - Text requests: still call `query_knowledge(user_msg)` as today.
10. Do not add new external API calls in this task.

## Verification (hard gates)
1. Start backend and confirm:
   - `GET /api/v1/health` returns ok
2. Validate old contract:
   - Text-only request without GPS still returns 200 with JSON containing `response`.
3. Validate new optional GPS contract:
   - Text-only request with `latitude` and `longitude` returns 200.
   - Vision request with `image_data` plus GPS returns 200.
4. Ensure no `.format()` KeyError:
   - If prompt templates are not yet updated to include `{city}`, make sure your formatting changes won’t throw.

## Risk notes
- Geolocation coordinates can be inaccurate; keep derivation tolerant and optional.
- Keep GPS fields optional to prevent breaking the existing frontend.
