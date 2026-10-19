# 18-manual-verification-runbook.md

## Purpose
Provide a final end-to-end manual verification runbook for the full “Claude Code tourist guide” feature set:
GPS → city context → live data cards → STT → TTS → 3D avatar with lipsync.

## Pre-reqs
1. Backend running:
   - `cd backend`
   - `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
2. Frontend running (in another terminal):
   - `cd frontend`
   - `npm run dev`
3. LM Studio:
   - Ensure LM Studio is running (port `1234`) for vision/chat inference.
   - If not running, tests related to landmark recognition may fail; document that.

## Verification Steps
### 1) Baseline sanity
1. Open frontend in browser.
2. Confirm chat UI renders:
   - message input works
   - send button works
3. Send a simple text question:
   - “Who are you?”
4. Confirm backend responds with JSON containing:
   - `response` (string)

### 2) GPS / city context
1. Click “Use my location” (if present).
2. Approve location permission.
3. Send a text question that should encourage city grounding:
   - “Where should I eat a local meal?”
4. Observe:
   - City badge shows a non-empty city string (if GPS-derived city is enabled)
   - The AI response references that city naturally (without claiming wrong city landmarks)
5. Deny location permission and repeat:
   - confirm the app still works and falls back gracefully

### 3) Live data cards (weather/restaurants/events)
1. With GPS enabled (or derived city available), send:
   - “What’s the weather and any top spots for dinner?”
2. Confirm UI shows live cards (when backend returns them):
   - Weather line appears
   - Restaurant list appears (2–3 items)
   - Events section appears (if implemented; otherwise may be absent)
3. If live APIs fail:
   - confirm chat still returns a response string
   - confirm UI either hides live cards or displays “unavailable”

### 4) Vision + GPS
1. Upload an image from a known landmark (existing test images are fine).
2. Ensure location is enabled.
3. Send with image attached.
4. Confirm:
   - backend completes successfully
   - response is returned
   - avatar (later) starts speaking when TTS is implemented

### 5) Speech-to-text (STT)
1. Click the mic button.
2. Speak a short question.
3. Confirm transcript appears in the input field.
4. Click send and confirm:
   - backend receives the transcript as `message`
   - UI remains responsive
5. If STT isn’t supported:
   - confirm mic feature fails gracefully and typing still works

### 6) Text-to-speech (TTS)
1. Send a text prompt that triggers a normal AI response.
2. Confirm:
   - audio starts playing automatically after response arrives
   - no repeated overlapping playback occurs
3. If TTS synthesis fails:
   - confirm user still gets AI text response
   - confirm errors are shown clearly (or logged)

### 7) Avatar + lipsync
1. Confirm avatar viewer area is visible on the right panel.
2. During TTS playback:
   - avatar mouth opens/closes according to the audio energy signal
   - no jittery or stuck mouth
3. After audio ends:
   - mouth returns toward neutral within a short time window
4. If VRM model is missing:
   - confirm fallback placeholder is shown and the app does not crash

## Final acceptance criteria
1. Chat endpoint still returns `response` string for both text-only and image+text requests.
2. GPS fields are optional and do not break existing flows.
3. Live cards show when live data is available; gracefully degrade when unavailable.
4. STT fills input and routes into the existing send flow.
5. TTS plays audio for AI responses.
6. Avatar is visible and mouth animation tracks audio energy during playback.

## Logging/Debugging notes
If something fails, check:
- Browser console (frontend errors)
- Backend logs for:
  - request validation
  - live_data fetch errors
  - TTS synthesis errors
