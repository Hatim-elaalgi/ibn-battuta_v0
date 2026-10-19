# 07-frontend-location-and-live-cards.md

## Purpose
Update the frontend chat UI to display:
1. A “current city” badge (derived from GPS on the backend)
2. Optional live cards (weather/restaurants/events) returned by the backend

This task must be backward compatible: if backend does not yet return `city`/`live`, the UI should still work.

## Pre-checks
1. Current UI location:
   - `frontend/src/components/chat/ChatContainer.jsx`
2. Current message shape in state:
   - `messages[]` items contain `{ id, sender, text, image? }`
3. Current fetch:
   - The frontend calls `POST /api/v1/chat` and expects JSON:
     - `{ response: string }`

## Implementation
### 1) Extend frontend message model (required)
1. Update message construction for AI responses:
   - When parsing the backend response JSON, read optional fields:
     - `data.city` (string, optional)
     - `data.live` (object, optional)
2. When creating `aiMsg`, include:
   - `aiMsg.city = data.city || null`
   - `aiMsg.live = data.live || null`

### 2) Render city badge (required)
3. Add a lightweight badge in the UI:
   - Location options:
     - In the header (“Travel Guide” area), below persona label, or
     - Above the message list as a small pill
4. Source for badge:
   - Prefer the latest AI message’s `city` OR keep a dedicated piece of state:
     - `const [currentCity, setCurrentCity] = useState(null);`
   - On each successful backend response:
     - `setCurrentCity(data.city ?? null)`
5. Display format:
   - If `currentCity` exists: show `📍 ${currentCity}`
   - Else: show nothing (or `📍 Unknown location`)

### 3) Render live cards (required)
6. Define a small rendering helper (inline or new component file):
   - Expected `data.live` shape (coordinate with task `06/07`):
     - `weather`: string or structured dict
     - `restaurants`: array of `{ name, cuisine? }`
     - `events`: array of `{ title, when?, note? }`
7. Render conditions:
   - Only render live cards when `msg.live` exists and has at least one section.
8. UI placement:
   - Put live cards at the top of the AI message bubble, above the response text
   - Example layout:
     - Weather line
     - 2–3 restaurant names
     - Optional events section
9. Keep cards compact for mobile:
   - Limit strings to short truncation (e.g., 40–60 chars)
10. If live data is missing:
   - Render only `msg.text` as today.

### 4) Keep chat contract stable (required)
11. Ensure request body remains unchanged from task `02`:
   - Must still send `{ message, image_data?, latitude?, longitude? }` if location is enabled.
12. Ensure fetch parsing is tolerant:
   - `data.response` must still be used as the main content.
13. Do not remove existing loader/error logic.

## Verification (hard gates)
1. With a running backend, verify:
   - Text-only chat still works even if backend returns only `{ response }`
2. When backend starts returning `city` and `live`:
   - City badge updates correctly
   - Live cards appear only when `live` exists
3. No UI regressions:
   - Image upload + vision chat still render the image preview inside messages.

## Risk notes
- Backend live payload shape may vary; implement defensive rendering (optional chaining).
- Avoid throwing on missing fields (`data.live?.weather` etc.).
