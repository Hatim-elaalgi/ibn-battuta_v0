# 09-tts-backend-endpoint.md

## Purpose
Add backend Text-to-Speech (TTS) so the frontend can turn the AI response into an audio clip and synchronize avatar mouth motion.

This task adds a new endpoint:
- `POST /api/v1/tts`

## Pre-checks
1. Current backend routes:
   - `GET /api/v1/health`
   - `POST /api/v1/chat`
2. Current response format:
   - `POST /api/v1/chat` returns JSON: `{ "response": "<string>" }`
3. Ensure you do not break `/api/v1/chat`.

## Implementation
### 1) Add new endpoint module (required)
1. Create file:
   - `backend/app/api/api_v1/endpoints/tts.py`
2. Implement:
   - `router = APIRouter()`
   - request model `TtsRequest` with at least:
     - `text: str`
     - optional: `language: Optional[str]`
     - optional: `voice: Optional[str]`
   - endpoint:
     - `@router.post("/tts")`
     - returns a WAV audio payload

### 2) TTS engine choice (required spec)
Because the project currently has no TTS engine, pick an engine that works without API keys.

Recommended for Windows local dev:
- `pyttsx3` (uses OS speech facilities)

Implementation constraints:
1. Add dependency:
   - update `backend/requirements.txt` to include `pyttsx3>=<latest compatible>` (choose a reasonable version; do not invent if you can’t confirm)
2. Synthesize to WAV:
   - Create a temporary file
   - `engine.save_to_file(text, temp_path)`
   - `engine.runAndWait()`
   - Read bytes and return them
3. Return response as binary:
   - use `fastapi.Response(content=audio_bytes, media_type="audio/wav")`
   - also set a helpful header:
     - `Content-Disposition: inline; filename="speech.wav"`

### 3) Add route to router (required)
4. Update `backend/app/api/api_v1/api.py` to include the new router:
   - `api_router.include_router(tts.router, tags=["tts"])`

### 4) Input validation + safety
5. If `text` is empty/whitespace:
   - return `400` with detail `"text is required"`
6. Add basic limits:
   - cap at e.g. 1000–2000 characters to avoid huge synth times
7. Error handling:
   - wrap synthesis in try/catch and return `500` with a safe error message (no secrets)

## Verification (hard gates)
1. Start backend and run:
   - `curl -X POST http://127.0.0.1:8000/api/v1/tts -H "Content-Type: application/json" -d "{\"text\":\"Hello traveler\"}" --output /tmp/out.wav`
2. Confirm:
   - HTTP 200
   - `Content-Type` is `audio/wav`
   - `/tmp/out.wav` (or Windows equivalent) exists and is non-empty
3. Confirm `/api/v1/chat` still works unchanged for existing calls.

## Risk notes
- `pyttsx3` depends on OS speech support; if synthesis fails on the machine, document the error and add a fallback (return `500` with message instructing user to install/enable voices).
- Network calls are not required for this approach.
