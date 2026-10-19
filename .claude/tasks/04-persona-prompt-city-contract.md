# 04-persona-prompt-city-contract.md

## Purpose
Update the prompt templates in `backend/app/core/prompts/persona.py` to explicitly consume:
- `city` (derived from GPS)
- `live_data` (injected later)
- existing `context` (from RAG)

This task updates only prompt templates and how they are formatted in `chat.py` so the next tasks can inject live data safely.

## Pre-checks
1. Inspect current prompt templates:
   - `backend/app/core/prompts/persona.py`
2. Current template contract:
   - Both templates are `str.format()`-ed with `context` only.
3. Current persona constraints:
   - Both templates say keep responses to 2–3 sentences max.
   - Scope: Tangier-only is currently enforced (must be updated for multi-city).

## Implementation
### 1) Update prompt templates contract (required)
1. In `backend/app/core/prompts/persona.py`, update both strings:
   - `IBN_BATTUTA_SYSTEM_PROMPT`
   - `VISION_SYSTEM_PROMPT`
2. Add required placeholders:
   - `{city}`
   - `{live_data}`
   - Keep `{context}` (existing).
3. Use a consistent block structure for the model:
   - Recommended:
     - `CityContext: {city}`
     - `LiveData: {live_data}`
     - `Context: {context}`
4. Update scope rules:
   - Replace “Only discuss Tangier” with:
     - “Use the provided city context as the primary grounding.”
     - “Do not claim places are in the user’s city unless supported by the provided context/live data.”
5. Preserve response length:
   - Keep 2–3 sentences max.
   - If live data exists, compress it into one clause (not a full paragraph).

### 2) Make formatting resilient (required)
6. In `backend/app/api/api_v1/endpoints/chat.py`, update formatting code so it always passes values for `{city}` and `{live_data}`:
   - Always pass:
     - `city=resolved_city or ""`
     - `live_data=live_data_block or ""` (may be empty for now)
7. Avoid `.format()` KeyErrors:
   - If you cannot update all formatting call sites, you must set default variables locally before calling `.format()`.

## Verification (hard gates)
1. Both prompts render without format errors for:
   - text-only request
   - vision request
   - requests with and without GPS-derived city
2. Existing functionality still works:
   - `/api/v1/chat` returns a string under `response`.
3. Persona boundaries still hold:
   - Model output remains concise (2–3 sentences max).

## Risk notes
- Prompt length: adding city/live blocks can increase token usage. Ensure blocks are short and only include essentials when data is present.
