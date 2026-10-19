# 15-multi-city-rag-ingest-and-routing.md

## Purpose
Complete the multi-city RAG expansion by:
1. Adding at least one extra city dataset (beyond Tangier)
2. Updating ingestion so all city datasets are loaded into Chroma
3. Updating chat endpoint routing so RAG retrieval is filtered by the derived `city`

## Pre-checks
1. `backend/app/core/rag.py` supports multi-city metadata and `query_knowledge(query_text, city=...)` (task `14`).
2. `backend/app/api/api_v1/endpoints/chat.py` derives a `resolved_city` from GPS (task `03`) and passes `city` into the prompt (task `04/06`).

## Implementation
### 1) Add an extra city dataset (required)
1. Create a new city data file under:
   - `backend/app/data/`
2. Suggested filename format:
   - `marrakech_data.txt` (or `paris_data.txt`)
3. Use the same document structure as `tangier_data.txt`:
   - City header line like `Marrakech, Morocco: A Comprehensive Guide`
   - Sections separated by:
     - `--- <CATEGORY> ---`
4. Include at least:
   - 4–6 sections
   - each section should contain a few paragraphs and at least 1–2 named landmarks/POIs relevant to that city

### 2) Update ingestion runner (required)
5. Update `backend/app/core/rag.py` `__main__` ingestion logic so it can ingest multiple cities:
   - Find all `*_data.txt` files in `backend/app/data/`
   - For each file:
     - derive `city_name` from filename (e.g., `marrakech_data.txt` -> `Marrakech`)
     - call `ingest_data(file_path, city_name)`
6. Ensure that ingestion deletes only the data for that city before re-inserting (task `14` should already support city-scoped delete).

### 3) Update chat RAG routing (required)
7. In `backend/app/api/api_v1/endpoints/chat.py`, update the text-only path:
   - Current:
     - `context = query_knowledge(user_msg)`
   - Update:
     - `context = query_knowledge(user_msg, city=resolved_city or None)`
8. Keep existing behavior for vision:
   - Vision requests may still skip RAG context to preserve tokens.
9. Ensure the prompt pipeline still uses:
   - `context` from RAG
   - `city` in prompt formatting
   - `live_data` injected (tasks `05–07`)

### 4) Optional: add a “no city” fallback
10. If `resolved_city` is empty/unknown:
   - let RAG run unfiltered: `query_knowledge(user_msg, city=None)`

## Verification (hard gates)
1. Ingestion works:
   - Run `python backend/app/core/rag.py`
   - Confirm ingestion logs show at least 2 cities loaded (Tangier + the new one)
2. City-filtered query:
   - Call `query_knowledge("Koutoubia", city="Marrakech")` and confirm it returns context mentioning Marrakech landmarks.
3. Chat end-to-end:
   - For a GPS-derived city of the new city:
     - text-only prompt should incorporate that city’s RAG context
4. No regressions:
   - If GPS is not provided, existing Tangier behavior should still function.

## Risk notes
- Persisted Chroma data may need to be cleared if you change collection strategy. Keep ingestion idempotent and city-scoped.
