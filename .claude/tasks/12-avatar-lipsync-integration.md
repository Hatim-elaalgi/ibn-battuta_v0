# 12-avatar-lipsync-integration.md

## Purpose
Wire mouth/lip movement to the real-time `mouthEnergy` signal produced from the TTS audio playback.

This task focuses on updating:
- `frontend/src/components/avatar/AvatarViewer.jsx` (from task `11`)

It assumes `AvatarViewer` receives props:
- `energy: number` in `[0..1]`
- `speaking: boolean`

## Pre-checks
1. Confirm `AvatarViewer` exists:
   - `frontend/src/components/avatar/AvatarViewer.jsx`
2. Confirm the avatar component has access to the VRM instance or blendshape proxy.
3. Confirm the frontend computes and passes `mouthEnergy`:
   - state created in `frontend/src/components/chat/ChatContainer.jsx` (task `10`)

## Implementation
### 1) Store blendshape controls (required)
1. In `AvatarViewer.jsx`, after VRM loads, locate:
   - `vrm.blendShapeProxy` (for facial blendshapes)
2. Decide mapping from energy -> mouth blendshape:
   - Common VRM blendshape names:
     - `aa` (open mouth / A vowel)
     - `ih` / `ee` (not always present)
     - `ou` (rounded mouth)
   - MVP mapping:
     - Use `aa` as the primary mouth movement driver.
3. Create refs:
   - `const currentEnergyRef = useRef(0)`
   - `const targetEnergyRef = useRef(0)`

### 2) Energy smoothing (required)
4. Implement smoothing so animation is not jittery:
   - Exponential moving average:
     - `current = current*0.85 + target*0.15`
5. Use `speaking` to gate:
   - If `speaking === false`, decay mouth value toward 0 even if last energy was high.

### 3) Apply blendshape in the render loop (required)
6. In `useFrame`, if VRM loaded:
   - Compute `mouthValue = clamp(currentEnergy * gain, 0, 1)`
     - choose `gain` ~ 1.2–2.0 depending on how your energy normalizes
   - Call blendshape:
     - `vrm.blendShapeProxy?.setValue('aa', mouthValue)`
   - Optionally add secondary animation:
     - blink: small probability or tie to speaking transitions (optional)

### 4) Safe fallbacks (required)
7. If blendshape proxy does not exist:
   - Fallback to simple mesh scaling or rotating:
     - e.g., adjust a head/neck scale slightly based on energy
   - Do not crash.
8. If VRM failed to load:
   - `AvatarViewer` already renders a placeholder; ensure lipsync logic checks for VRM existence.

## Verification (hard gates)
1. With speaking audio:
   - mouth movement visibly tracks audio loudness (energy peaks => more mouth open)
2. When audio ends:
   - mouth returns toward neutral quickly (within ~0.5–1.5s)
3. No crashes:
   - VRM missing -> no errors in console
4. Performance:
   - Animation loop remains stable (no heavy CPU spikes)

## Risk notes
- Blendshape key names vary per VRM file; implement a small helper that logs available keys once.
- Energy normalization may not map well; adjust `gain` and smoothing.
