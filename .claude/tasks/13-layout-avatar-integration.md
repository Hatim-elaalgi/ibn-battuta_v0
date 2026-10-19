# 13-layout-avatar-integration.md

## Purpose
Integrate the avatar viewer into the main layout by replacing `MapPlaceholder`.

Because the avatar needs `energy`/`speaking` signals produced in the chat (task `10`), this task also specifies how to lift that state from `ChatContainer` to `MainLayout` and pass it into `AvatarViewer`.

## Pre-checks
1. `frontend/src/components/layout/MainLayout.jsx` currently renders:
   - Left: `ChatContainer`
   - Right: `MapPlaceholder`
2. `AvatarViewer` should exist:
   - `frontend/src/components/avatar/AvatarViewer.jsx` (task `11`)
3. `ChatContainer` should compute:
   - `mouthEnergy`
   - `isSpeaking`

## Implementation
### 1) Update MainLayout to host AvatarViewer (required)
1. Edit `frontend/src/components/layout/MainLayout.jsx`:
   - Remove/replace `MapPlaceholder` usage.
2. Import `AvatarViewer`:
   - `import AvatarViewer from '../avatar/AvatarViewer';` (adjust relative path)
3. Add state in `MainLayout`:
   - `const [mouthEnergy, setMouthEnergy] = useState(0);`
   - `const [isSpeaking, setIsSpeaking] = useState(false);`

### 2) Lift avatar state from ChatContainer (required)
4. Modify `frontend/src/components/chat/ChatContainer.jsx` signature:
   - Change default export to accept a callback prop:
     - `function ChatContainer({ onAvatarState }) { ... }`
5. In `ChatContainer`, whenever `mouthEnergy` or `isSpeaking` changes:
   - call the callback:
     - `onAvatarState?.({ energy: mouthEnergy, speaking: isSpeaking })`
6. In `MainLayout`, pass callback to ChatContainer:
   - `<ChatContainer onAvatarState={({ energy, speaking }) => { setMouthEnergy(energy); setIsSpeaking(speaking); }} />`

### 3) Keep layout responsive (required)
7. Preserve the existing split layout:
   - Left panel: chat
   - Right panel: avatar viewer
8. Ensure avatar container stretches full height:
   - Right panel should have `h-full` and `w-full`.

### 4) Optional: keep MapPlaceholder as a fallback
9. If avatar assets are missing, allow `AvatarViewer` to show placeholder:
   - No need to keep map placeholder, but optionally add:
     - a small toggle to show map placeholder below avatar.

## Verification (hard gates)
1. The UI renders without runtime errors:
   - `MapPlaceholder` no longer required.
2. When you send a message and TTS playback starts:
   - `isSpeaking` becomes true
   - avatar mouth moves with energy changes
3. When audio stops:
   - avatar mouth returns toward neutral
4. Text + image chat flows still work.

## Risk notes
- Updating parent state too frequently can be expensive; if performance suffers, throttle callback updates (e.g., update every 50–100ms).
