# 01-audit-baseline.md

## Purpose
Create a precise baseline audit of the current repo state vs `wholeProject.md`, and confirm that the existing `/api/v1/chat` endpoint works for both text-only and vision (image) requests.

## Pre-checks (read-only)
1. Confirm current files and contracts:
   - `frontend/src/components/chat/ChatContainer.jsx`
   - `backend/app/api/api_v1/endpoints/chat.py`
   - `backend/app/core/prompts/persona.py`
   - `backend/app/core/rag.py`
   - `frontend/src/components/layout/MainLayout.jsx`
2. Confirm the app can run:
   - Backend start: from `backend/`, run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
   - Frontend start: from `frontend/`, run `npm run dev`
3. Confirm health:
   - `GET http://127.0.0.1:8000/api/v1/health` returns `{"status":"ok"}`
4. Confirm chat request/response shape:
   - Text-only request: `POST /api/v1/chat` with `{ "message": "..." }` returns JSON with key `response` (string)
   - Vision request: `POST /api/v1/chat` with `{ "message": "...", "image_data": "data:image/jpeg;base64,..." }` returns JSON with key `response` (string)

## Implementation (auditing + reporting only)
1. Run at least one backend script to validate the vision pathway end-to-end:
   - Run `python test_backend_endpoint.py` (ensure backend is running)
2. Inspect and record the gaps vs the blueprint:
   - `wholeProject.md` expects: GPS/location context, live data (weather/restaurants/events), voice input/output, and a 3D embodied avatar layer.
   - Current repo implements: chat + vision (Qwen 3 VL via LM Studio) and Tangier-only RAG via Chroma.
3. Produce an audit report (required):
   - Create `.claude/audit-baseline.md` containing:
     - A short “what works now” section (with exact endpoint + files)
     - A “missing vs blueprint” section listing missing capabilities and where they should be added (point to specific files)
     - Any blocking issues you find (e.g., missing dependencies, CORS, LM Studio connectivity)

## Verification (hard gates)
1. `.claude/audit-baseline.md` exists and includes:
   - Verification that `/api/v1/chat` returns `{ response: <string> }` for both text-only and image requests
   - A gap list referencing at least `ChatContainer.jsx`, `chat.py`, `persona.py`, and `rag.py`
2. No code changes should be necessary for this task (unless you must fix something to run baseline checks).

## Risk notes
- If LM Studio is not running on `127.0.0.1:1234`, vision tests may fail; note this in the audit report.
