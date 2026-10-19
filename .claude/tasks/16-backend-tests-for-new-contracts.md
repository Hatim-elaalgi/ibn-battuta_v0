# 16-backend-tests-for-new-contracts.md

## Purpose
Add/adjust backend tests so the new request contract and new TTS endpoint are verified:
- `POST /api/v1/chat` accepts optional `latitude`, `longitude`, and `city`
- `POST /api/v1/tts` returns `audio/wav` with non-empty content

Tests should not break existing chat/vision behavior.

## Pre-checks
1. Understand current testing style:
   - Repo uses standalone Python scripts (e.g., `test_backend_endpoint.py`, `test_backend_error.py`, etc.)
2. Current test assumptions:
   - Some scripts require LM Studio / vision model to be running.

## Implementation
### 1) Add a chat contract test (required)
Create a new script at repo root:
- `test_backend_chat_location_contract.py`

Test steps:
1. Ensure backend is reachable (`GET /api/v1/health` or a small retry loop).
2. Call `/api/v1/chat` with:
   - message only:
     - payload: `{ "message": "What should I see in Tangier?" }`
   - message + GPS:
     - payload includes: `latitude` and `longitude` (use Tangier approximate coords)
3. Verify response:
   - HTTP status 200
   - JSON contains `response` (string)
   - (optional) if implemented by tasks `06/07`:
     - `city` is either a string or null
     - `live` is either missing or a dict
4. Do not assert exact landmark text (LLM output is variable).

### 2) Add a chat “vision + GPS” smoke test (required)
Create another script:
- `test_backend_vision_location_smoke.py`

Test steps:
1. Prepare a small JPEG:
   - reuse existing test image patterns (e.g., `tanger-kashbah-888.jpg`)
   - create a thumbnail to limit payload size
2. Send:
   - payload includes `image_data` + `latitude`/`longitude`
3. Verify:
   - HTTP 200
   - JSON contains `response` as a string

### 3) Add TTS endpoint test (required)
Create:
- `test_backend_tts_endpoint.py`

Test steps:
1. Ensure backend is reachable.
2. POST to `/api/v1/tts` with:
   - `{ "text": "Hello traveller from Ibn Battuta." }`
3. Verify:
   - HTTP 200
   - response headers include `Content-Type: audio/wav`
   - body length > some minimum bytes (e.g., > 500 bytes)
4. Save audio to disk for manual inspection:
   - e.g., `tts_test_output.wav`

### 4) Update existing scripts only if needed (optional)
If existing scripts break due to request model changes (e.g., Pydantic errors):
- Update them to include GPS fields only when appropriate
- Keep them passing by omitting optional GPS fields

## Verification (hard gates)
1. Run scripts in this order (with backend running):
   - `python test_backend_chat_location_contract.py`
   - `python test_backend_tts_endpoint.py`
   - (optional) `python test_backend_vision_location_smoke.py` if LM Studio is available
2. Ensure no script fails due to live-data network errors:
   - if live-data fetch fails, backend should still return a chat response (with fallback `live_data`)

## Risk notes
- Live data APIs can rate-limit or be unavailable; your live-data module should provide safe fallback so tests remain stable.
- Vision tests require LM Studio and the vision model; treat them as optional if the model isn’t available.
