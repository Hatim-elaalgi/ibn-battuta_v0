# 10-tts-playback-and-mouth-energy-driver-frontend.md

## Purpose
After receiving the AI `response` from `POST /api/v1/chat`, the frontend must:
1. Call `POST /api/v1/tts` to get audio
2. Play that audio
3. Compute a real-time “mouth energy” value from the audio stream

This task implements the audio + energy driver; avatar binding happens in later tasks (`11`–`13`).

## Pre-checks
1. Confirm backend TTS endpoint exists per task `09`:
   - `POST /api/v1/tts` returns `audio/wav` bytes
2. Confirm frontend can parse chat responses per task `07`:
   - it still sets messages from `data.response`
3. Confirm you do not break existing chat + image preview.

## Implementation
### 1) Add audio playback wiring (required)
1. Update `frontend/src/components/chat/ChatContainer.jsx`:
   - After you receive `data.response`, start TTS playback.
2. Add state:
   - `isSpeaking: boolean`
   - `mouthEnergy: number` in range `[0, 1]`
3. Add function `speakText(text: string)`:
   - POST to `http://127.0.0.1:8000/api/v1/tts`
   - Body JSON: `{ "text": text }` (plus `language/voice` only if you already support it)
   - Read response as `arrayBuffer`
   - Create blob URL:
     - `const blob = new Blob([audioBuffer], { type: 'audio/wav' })`
     - `const url = URL.createObjectURL(blob)`
   - Create an `Audio` element and play:
     - ensure you stop previous playback if a new message arrives

### 2) Compute mouth energy from the audio (required)
4. Use Web Audio API with an analyser:
   - Create `AudioContext`
   - Connect:
     - media element source -> analyser -> destination
5. Configure analyser:
   - `analyser.fftSize = 2048` (or similar)
   - read `frequencyBinCount`
6. Define RMS energy:
   - Retrieve `getByteTimeDomainData()`
   - Convert to normalized floats
   - Compute RMS and normalize to `[0,1]`
   - Apply smoothing:
     - exponential moving average to avoid jitter
7. Update `mouthEnergy` continuously while speaking:
   - Start `requestAnimationFrame` loop when playback starts
   - Stop loop when playback ends
8. Cleanup:
   - on audio end, set `isSpeaking=false` and decay `mouthEnergy` toward 0
   - revoke object URL

### 3) Integration point for avatar (required interface)
9. Even if the avatar component does not exist yet, define the interface now:
   - `AvatarViewer` (later) should accept:
     - `energy={mouthEnergy}`
     - `speaking={isSpeaking}`
10. If there is no avatar yet, you can:
   - keep these states in ChatContainer for later wiring
   - or render a temporary debug bar showing energy level

## Verification (hard gates)
1. On each AI response, the browser plays audio.
2. `mouthEnergy`:
   - increases when audio is loud and decreases when audio stops/silences
   - remains within `[0,1]` after normalization
3. When multiple messages are sent quickly:
   - the previous audio playback is stopped/cancelled
   - energy updates correspond to the currently playing audio only

## Risk notes
- Autoplay policies can prevent audio unless triggered by a user gesture; ensure `handleSend` is user initiated.
- Some browsers have limited WAV decoding support; if decoding fails, document and fall back to playing via `<audio>` without analyser.
