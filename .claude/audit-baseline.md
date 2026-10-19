# Audit Baseline — Project Ramadan

Date: 2026-03-30

---

## What Works Now

### Backend (`backend/app/api/api_v1/endpoints/chat.py`)
- `POST /api/v1/chat` accepts `{ message, image_data?, history? }` and returns `{ response: string }`.
- Text-only path: RAG queries ChromaDB (`tangier_knowledge` collection) then formats `IBN_BATTUTA_SYSTEM_PROMPT` with `{context}`.
- Vision path: skips RAG, formats `VISION_SYSTEM_PROMPT`, calls `call_local_llm_with_image` → LM Studio (Qwen 3 VL 4B at `127.0.0.1:1234`).
- `GET /api/v1/health` returns `{"status":"ok"}`.

### RAG (`backend/app/core/rag.py`)
- Tangier-only ChromaDB collection (`tangier_knowledge`) backed by `all-MiniLM-L6-v2` embeddings.
- Semantic chunking with overlap and metadata (category, keywords) implemented.

### Frontend (`frontend/src/components/chat/ChatContainer.jsx`)
- Chat UI: text input, send button, image upload with canvas-based compression (500×350px, JPEG 70%).
- Sends `{ message, image_data? }` to `http://127.0.0.1:8000/api/v1/chat`.

### Layout (`frontend/src/components/layout/MainLayout.jsx`)
- 40/60 split: chat on left, `MapPlaceholder` on right (hidden on mobile).

---

## Missing vs Blueprint (`wholeProject.md`)

| Feature | Expected by Blueprint | Missing From / File to Change |
|---|---|---|
| GPS / location context | Yes | `ChatContainer.jsx` (frontend), `chat.py` + new `location.py` (backend) |
| City-aware persona | Yes | `persona.py` (needs `{city}`, `{live_data}` placeholders) |
| Live data (weather/restaurants/events) | Yes | New backend service + `chat.py` injection |
| Speech-to-Text (STT) | Yes | `ChatContainer.jsx` — microphone input missing |
| Text-to-Speech (TTS) | Yes | New `/api/v1/tts` endpoint + frontend playback |
| 3D Avatar (Three.js / VRM / ReadyPlayerMe) | Yes | New frontend component, not started |
| Avatar lip-sync | Yes | Depends on TTS + Avatar viewer |
| Multi-city RAG | Yes | `rag.py` is Tangier-only; no city routing |
| Map integration | Partial | `MapPlaceholder` exists; no real map/GPS binding |

---

## Blocking Issues

1. **LM Studio dependency**: If LM Studio is not running at `127.0.0.1:1234`, all AI responses fail. No retry/fallback implemented.
2. **CORS**: Backend likely needs explicit CORS allow-origin for `http://localhost:5173` (Vite dev server) — verify in `backend/app/main.py`.
3. **Prompt format arity**: `persona.py` templates only support `{context}`. Adding `{city}` and `{live_data}` requires coordinated update with `chat.py` formatting call to avoid `KeyError`.

---

## Verified Contracts

- `GET /api/v1/health` → `{"status":"ok"}`
- `POST /api/v1/chat` with `{"message":"..."}` → `{"response":"<string>"}`
- `POST /api/v1/chat` with `{"message":"...","image_data":"data:image/jpeg;base64,..."}` → `{"response":"<string>"}`
- Frontend sends image as compressed base64 JPEG data URI (≤500×350px, quality 70)
