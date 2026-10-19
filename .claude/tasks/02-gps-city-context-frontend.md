# 02-gps-city-context-frontend.md

## Purpose
Add browser geolocation to the frontend and include `latitude`/`longitude` in chat requests sent to `POST /api/v1/chat`.

This task only changes the frontend UI + request payload shape. City derivation happens later on the backend.

## Pre-checks
1. Confirm current request payload from `frontend/src/components/chat/ChatContainer.jsx`:
   - It currently sends `{ message: string, image_data?: string }` to `http://127.0.0.1:8000/api/v1/chat`.
2. Confirm current UI elements:
   - There is an image upload button, a text input, and a send button.
3. Confirm you will not break existing behavior when location is unavailable:
   - If geolocation permission is denied or fails, chat must still work with `{ message, image_data? }`.

## Implementation
### Frontend state + UI
1. In `frontend/src/components/chat/ChatContainer.jsx`, add new state:
   - `coords` (object with `{ latitude, longitude }` or `null`)
   - `locationStatus` (e.g., `"unset" | "loading" | "granted" | "denied" | "error"`)
2. Add a visible control to request location permission:
   - A button such as `Use my location (optional)`
   - Show a small badge/label with status:
     - On success: show `Lat/Lon captured`
     - On error/denied: show `Location unavailable (continuing)`
3. Implement click handler:
   - Use `navigator.geolocation.getCurrentPosition`
   - On success, set `coords`
   - On failure, keep `coords = null` and set status to denied/error
4. Do not block sending:
   - If user presses send before coords are available, send request without location fields.

### Request payload changes (required)
5. Update `handleSend` request body so it includes location only when available:
   - Always send: `message: userMsg.text || "What can you see in this image?"`
   - If `coords` exists, add:
     - `latitude: coords.latitude`
     - `longitude: coords.longitude`
6. Ensure both request types include location consistently:
   - Text-only: `{ message, latitude?, longitude? }`
   - Vision (image): `{ message, image_data, latitude?, longitude? }`

### (Optional but recommended) image flow UX
7. When an image is selected, keep current behavior:
   - The image preview and compression should be unchanged.
8. If location permission is granted after selecting an image, sending should include it automatically (based on `coords` state).

## Verification (hard gates)
1. Start the backend and frontend locally.
2. Confirm the request payload sent from the browser includes:
   - `latitude` and `longitude` when permission is granted
   - no `latitude`/`longitude` when denied or unavailable
3. Confirm `POST /api/v1/chat` still returns a response when:
   - location is denied
   - location is not requested
   - image is attached
4. Confirm no console errors from the geolocation feature when unsupported:
   - If `navigator.geolocation` is missing, gracefully fall back.

## Risk notes
- Browser geolocation requires user permission; always implement a fallback.
- Keep location optional to avoid breaking current chat + vision flows.
