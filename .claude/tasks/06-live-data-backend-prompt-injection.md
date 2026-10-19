# 06-live-data-backend-prompt-injection.md

## Purpose
Inject live data (weather/restaurants/events) into the system prompt for the chat endpoint.

This task wires the live-data module into `backend/app/api/api_v1/endpoints/chat.py` and (optionally) extends the response schema so the frontend can render “live cards”.

## Pre-checks
1. Ensure `backend/app/core/live_data.py` exists (from task `05`).
2. Ensure prompt templates accept `{city}` and `{live_data}` (from task `04`).
3. Confirm current chat request flow:
   - Vision requests currently skip RAG context (`context = ""`)
   - Text requests call `query_knowledge(user_msg)` to build `context`

## Implementation
### 1) Wire live data fetch into chat endpoint (required)
1. Edit `backend/app/api/api_v1/endpoints/chat.py`
2. Extend `ChatRequest` if needed:
   - It should already accept optional `latitude`, `longitude`, `city` from task `03`.
3. Compute `resolved_city` (or reuse what task `03` did):
   - If `request.city` exists: use it
   - Else if `latitude` and `longitude` exist: derive city
   - Else: `resolved_city = ""`
4. Create a `live_data_block` string:
   - Default:
     - `"Live data unavailable at the moment."` or `""`
5. Fetch live data only when safe:
   - Recommended rule:
     - If `resolved_city` is non-empty OR coords exist: fetch
     - Else: skip fetch and use fallback string
   - Always avoid failing the request:
     - Wrap live-data fetch in try/catch and fallback
6. Inject into prompt:
   - When building `full_system_prompt`, call:
     - `system_prompt_template.format(context=context, city=resolved_city, live_data=live_data_block)`
   - Ensure `context` is still preserved per the existing logic:
     - Vision: keep `context=""` (skip RAG)
     - Text: keep existing RAG `context`

### 2) Keep the vision token budget safe
7. Since vision requests already use image input that consumes tokens:
   - Keep `live_data_block` extremely short (target < 250–400 chars)
   - Limit restaurants to 2–3 and events to 1–2 in the formatter used here

### 3) (Optional but recommended) extend response schema for UI cards
8. Update `ChatResponse` to add optional live fields:
   - Example:
     - `live: Optional[dict] = None`
     - `city: Optional[str] = None`
9. Populate `response.city = resolved_city` when known.
10. Populate `response.live` with the structured parts used in formatter:
   - If `live_data.py` already returns dicts, reuse them.
   - If not, create a small `dict` in `chat.py`:
     - `{"weather": ..., "restaurants": [...], "events": [...] }`
11. Ensure backward compatibility:
   - Frontend should still work if it ignores `live` and `city`.

## Verification (hard gates)
1. Start backend and run a text-only request without coords:
   - `/api/v1/chat` returns 200 and still includes `response`
   - System prompt formatting must not throw even if city/live_data are missing
2. Run a text-only request with GPS fields:
   - Confirm server attempts live-data fetch (in logs)
3. Run a vision request with GPS fields:
   - Confirm request completes and uses vision prompt + `live_data_block`
4. Confirm response shape:
   - `response.response` remains a string
   - Optional `live` and `city` are present only if implemented

## Risk notes
- Live-data APIs can be slow; use timeouts and caching (prefer caching from task `05`).
- Never allow live-data failures to prevent chat responses.
