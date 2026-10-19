# 17-frontend-tests-smoke.md

## Purpose
Add lightweight smoke/regression checks for the frontend so the new GPS, live cards, STT, TTS playback, and avatar UI wiring don’t break the app.

This repo doesn’t currently use a formal frontend test runner (no Playwright/Jest in the structure), so this task defines:
- build/lint checks
- a short manual verification checklist

## Pre-checks
1. Current frontend scripts (from `frontend/package.json`):
   - `npm run dev`
   - `npm run build`
   - `npm run lint`

## Implementation
### 1) Add a smoke script (required)
Create a new helper script at repo root:
- `test_frontend_smoke.ps1` (PowerShell) OR `test_frontend_smoke.sh` (choose one matching your environment)

The script should:
1. `cd frontend`
2. Run:
   - `npm run lint`
   - `npm run build`
3. Print:
   - whether build succeeded

### 2) Build-time checks specific to new features (required)
Ensure the following compile-time issues are covered by `npm run build`:
- missing imports in `ChatContainer.jsx`
- new props passed to `AvatarViewer` (if it exists)
- new dependencies for 3D (task `11`) are installed if the build includes them

Optional (if you add them later):
- Add TypeScript? (Not required here; current frontend is JSX)

## Verification (hard gates)
1. With the repo in a consistent state, running the script succeeds:
   - frontend build completes with exit code 0
2. No runtime-only crashes expected:
   - Manual open in browser and verify the app renders

## Manual smoke checklist (quick)
1. Start backend:
   - `uvicorn app.main:app --host 127.0.0.1 --port 8000`
2. Start frontend:
   - `npm run dev`
3. In the UI:
   - send a text-only message (should return some response string)
   - verify location badge area exists (even if empty/unknown)
   - verify the UI doesn’t freeze when TTS/voice is unavailable
4. If TTS/voice exists:
   - send a message and confirm audio starts playing
   - confirm avatar area updates (even if placeholder)

## Risk notes
- If 3D/VRM dependencies are heavy, build may take longer; smoke gate should still be based on success.
- If live-data calls are moved client-side later (not recommended), adjust smoke expectations accordingly.
