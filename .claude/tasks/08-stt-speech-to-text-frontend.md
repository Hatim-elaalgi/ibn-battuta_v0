# 08-stt-speech-to-text-frontend.md

## Purpose
Add best-effort Speech-to-Text (STT) to the frontend chat UI using the browser Web Speech API, and route the recognized transcript into the existing message send flow.

This task should be graceful:
- If STT is unsupported, hide/disable the mic feature and continue to work with typing + image upload.

## Pre-checks
1. Current chat input and send flow:
   - `frontend/src/components/chat/ChatContainer.jsx`
   - `input` state holds the text input value.
   - `handleSend` sends `requestBody = { message, image_data? , ...gps? }`.
2. Ensure compatibility with tasks `02` and `07`:
   - The request body may already include `latitude`/`longitude` if geolocation is enabled.

## Implementation
### 1) Add STT UI controls
1. In `ChatContainer.jsx`, add a mic button near the send button.
2. Add new state:
   - `isListening` boolean
   - `sttError` string|null (optional)
3. Mic button behavior:
   - If not listening: starts recognition
   - If listening: stops recognition
4. Show a small “Listening…” indicator while active.

### 2) Implement Web Speech API wiring
5. Use this compatibility pattern:
   - `const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;`
6. If `SpeechRecognition` is undefined:
   - disable mic button and do not throw errors
7. Create a recognition instance when starting:
   - `const recognition = new SpeechRecognition();`
   - Configure:
     - `recognition.lang` (default `en-US`, or attempt user language)
     - `recognition.interimResults = true` (optional)
     - `recognition.continuous = false`
8. Event handlers:
   - `onresult`: update `input` with the latest transcript
     - If interim results: show partial transcript
     - When final: mark `isListening=false`
   - `onerror`: set `sttError` and `isListening=false`
   - `onend`: ensure `isListening=false` even if ended unexpectedly

### 3) Route transcript into the existing send flow
9. While recognizing:
   - do not automatically send unless the user clicks send
   - (recommended) fill `input` continuously and allow user to edit
10. On user click send:
   - `handleSend` uses `input.trim()` as it already does.
11. Edge case: image selected with empty input:
   - existing logic already sends `userMsg.text || "What can you see in this image?"`
   - ensure STT transcript will populate `input`, so user can speak a question.

## Verification (hard gates)
1. With STT supported:
   - Click mic, speak a short question (e.g., “Where should I eat tagine?”)
   - Confirm transcript appears in the input box
   - Click send and confirm backend receives the spoken question
2. With STT unsupported:
   - UI still works (typing + image upload + sending)
   - no runtime crash

## Risk notes
- Browsers differ: some require HTTPS or user gesture; errors should not break chat.
- Keep recognition optional and best-effort.
