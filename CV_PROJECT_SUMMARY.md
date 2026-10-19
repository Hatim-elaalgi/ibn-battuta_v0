# Ibn Battuta — AI Historical Tourist Guide

**Full-stack, multimodal AI travel companion embodied as an animated 3D historical persona, powered by a locally-hosted vision-language model, RAG-grounded knowledge, and live real-world data.**

---

## 1. One-line pitch

A context-aware AI tourist guide that talks, sees, and moves — an interactive 3D avatar of the medieval explorer **Ibn Battuta** who answers questions by text, voice, or photo, grounded in real city knowledge and live conditions (weather, prayer times, events, news), and can generate full multi-day itineraries.

## 2. Elevator pitch (for interviews)

> "I built a full-stack AI travel guide where a 3D avatar of the historical explorer Ibn Battuta acts as your personal tour guide. It runs a locally-hosted vision-language LLM so it can answer questions from a photo of a landmark, uses retrieval-augmented generation over a curated knowledge base so it doesn't hallucinate facts, and pulls in live weather, prayer times, and local events from eight public APIs. The frontend renders the avatar in 3D with real-time lip-sync driven by text-to-speech, and there's a three-pass LLM pipeline that plans, selects places from a database, and narrates a full multi-day itinerary in the guide's voice."

## 3. Core features

- **Conversational AI persona** — chat with a historical character (Ibn Battuta) whose tone, knowledge, and recommendations are shaped by a dedicated persona/system-prompt layer, with streaming (SSE) responses for a natural typing effect.
- **Multimodal input** — users can type, speak (voice input), or upload a photo of a landmark; the backend routes image + text together to a vision-language model for landmark recognition and explanation.
- **3D embodied avatar** — a GLB/VRM 3D character rendered with Three.js / React Three Fiber, with custom real-time jaw/mouth deformation for lip-sync synchronized to generated speech audio, plus idle animations.
- **Text-to-speech** — responses are converted to natural neural speech (Microsoft Edge TTS, per-language voice selection, adjustable rate/pitch) and played back in sync with the avatar.
- **Retrieval-Augmented Generation (RAG)** — a ChromaDB vector store (Sentence-Transformers embeddings) indexes hand-curated per-city knowledge (history, landmarks, food, culture) with metadata/keyword filtering, so the LLM answers are grounded rather than hallucinated.
- **Location & context awareness** — resolves the user's city from GPS coordinates and tailors the persona's answers, recommendations, and live-data block to wherever they actually are.
- **Live data intelligence** — aggregates 8 free public APIs **in parallel** (weather, air quality, prayer times, public holidays, currency/country info, Wikipedia summaries, live news headlines, and OSM/Overpass points of interest) with a 10-minute cache layer to keep the guide's context current without hammering rate limits.
- **AI-generated itineraries** — a 3-pass LLM pipeline: (1) plans a day-by-day trip outline in strict JSON, (2) selects and orders real places from the database per day, (3) narrates each stop in the guide's voice — all streamed to the frontend as progress events (SSE) so the UI updates live as the plan is built.
- **Interactive maps** — Leaflet-based map views for exploring points of interest and walking routes per city.
- **Itinerary management** — users can create, edit, and browse saved multi-day trip plans ("My Journeys").

## 4. Architecture

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│           Frontend         │  HTTP  │            Backend            │
│  React 19 + Vite + Tailwind│◄──────►│           FastAPI             │
│  React Three Fiber (3D)    │  SSE   │                                │
│  Leaflet (maps)            │        │  ┌──────────────────────────┐  │
│  Framer Motion (UI)        │        │  │ Persona / Prompt Layer   │  │
└────────────────────────────┘        │  ├──────────────────────────┤  │
                                       │  │ RAG (ChromaDB +          │  │
                                       │  │ sentence-transformers)   │  │
                                       │  ├──────────────────────────┤  │
                                       │  │ Live Data Aggregator     │  │
                                       │  │ (8 parallel public APIs) │  │
                                       │  ├──────────────────────────┤  │
                                       │  │ Itinerary Generator      │  │
                                       │  │ (3-pass LLM pipeline)    │  │
                                       │  ├──────────────────────────┤  │
                                       │  │ TTS (edge-tts)           │  │
                                       │  └──────────────────────────┘  │
                                       │       SQLAlchemy + SQLite/PG   │
                                       └────────────┬───────────────────┘
                                                     │
                                          ┌──────────▼───────────┐
                                          │  Local LLM Runtime    │
                                          │  LM Studio             │
                                          │  Qwen3-VL-4B            │
                                          │  (text + vision)       │
                                          └────────────────────────┘
```

## 5. Tech stack

**Frontend**
- React 19, Vite, React Router
- React Three Fiber, Three.js, `@pixiv/three-vrm` — 3D avatar rendering & animation
- Tailwind CSS 4, Framer Motion — UI & motion design
- Leaflet / React-Leaflet — interactive maps
- Custom hooks for geolocation, itinerary state, and live-data polling

**Backend**
- FastAPI (async, streaming responses via SSE)
- SQLAlchemy ORM + SQLite/PostgreSQL — places, itineraries, users
- ChromaDB + Sentence-Transformers (`all-MiniLM-L6-v2`) — vector search / RAG
- `edge-tts` — neural text-to-speech
- `httpx` / `requests` + `ThreadPoolExecutor` — parallel external API calls with caching

**AI**
- Qwen3-VL-4B running locally via **LM Studio**, accessed through its REST API (`/api/v1/chat`) supporting text, image, streaming, and structured JSON-mode-via-prompting output
- Custom prompt-engineering layer for persona consistency and reliable JSON extraction from a model without native JSON mode

**External data (all free, no-key or free-tier APIs)**
- Open-Meteo (weather + air quality), Overpass API (OSM POIs/restaurants), Aladhan (prayer times), Nager.Date (holidays), RestCountries, Wikipedia REST, BBC/Al Jazeera RSS (news)

## 6. Notable engineering details

- **Local-first AI**: runs a vision-language model entirely on local hardware via LM Studio instead of a paid cloud API, handling both the multimodal chat and JSON-structured itinerary generation.
- **Robust JSON extraction from a non-JSON-native model**: implemented a bracket-depth parser with markdown-fence stripping and an automatic retry-with-stricter-prompt fallback, since Qwen3-VL-4B has no reliable native JSON mode.
- **Parallelized live-data fetching**: 8 independent third-party APIs are called concurrently with a `ThreadPoolExecutor` and a 10-minute TTL cache keyed by city/coordinates, keeping end-to-end latency close to that of the single slowest API rather than the sum of all calls.
- **Streaming everywhere**: both chat responses and itinerary generation stream incrementally to the client over Server-Sent Events, giving a responsive, "typing"/"thinking" feel instead of a long blocking wait.
- **Real-time lip-sync without pre-baked animations**: the avatar's jaw deformation is computed at runtime by scanning the loaded GLB mesh's vertex positions to identify jaw-region vertices, then deforming them procedurally in sync with generated audio — no manual rigging or pre-recorded animation clips required.
- **RAG with metadata-aware retrieval**: knowledge chunks are tagged with extracted categories and keywords (locations, activities) at ingestion time to improve retrieval precision beyond plain vector similarity.

## 7. Suggested CV / resume bullets

Pick 3-5 depending on the role you're targeting:

- Built a full-stack multimodal AI travel guide (React + FastAPI) featuring a real-time animated 3D avatar, voice I/O, and photo-based landmark recognition powered by a locally-hosted vision-language LLM.
- Designed and implemented a RAG pipeline (ChromaDB + Sentence-Transformers) to ground LLM responses in curated knowledge, reducing hallucination for location-specific facts.
- Built a 3-pass LLM pipeline (plan → select → narrate) that generates structured, database-grounded multi-day travel itineraries and streams progress to the client via Server-Sent Events.
- Aggregated 8 external public APIs (weather, air quality, prayer times, holidays, news, POIs) into a single low-latency live-context service using concurrent requests and caching.
- Implemented procedural, runtime lip-sync for a 3D character by analyzing mesh geometry directly, avoiding the need for pre-rigged facial animations.
- Engineered reliable structured (JSON) output from a local LLM lacking native JSON mode via prompt engineering, fence-stripping, and automatic retries.

## 8. Skills demonstrated

`Full-stack development` · `LLM integration (local/self-hosted)` · `Prompt engineering` · `RAG / vector databases` · `Multimodal AI (vision + text + speech)` · `3D graphics / WebGL` · `Real-time streaming (SSE)` · `REST API design` · `Concurrent programming` · `Third-party API integration` · `React` · `FastAPI` · `SQL`
