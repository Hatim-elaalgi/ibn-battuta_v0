# 14-multi-city-rag-datasets-and-metadata.md

## Purpose
Refactor the backend RAG layer (`backend/app/core/rag.py`) so it supports multiple cities via metadata, while keeping backward compatibility with current `query_knowledge(user_msg)` calls.

After this task:
- ChromaDB chunks include a `city` metadata field.
- `query_knowledge(query_text, city=None)` works:
  - If `city` is provided: filter to that city
  - If `city` is None: search across all cities

## Pre-checks
1. Inspect current RAG implementation:
   - `backend/app/core/rag.py`
2. Current behavior:
   - Single persistent collection: `tangier_knowledge`
   - Single source file: `tangier_data.txt`
   - Metadata currently includes: `source`, `category`, `keywords`, `chunk_size`
3. Current ingestion:
   - Only runs for Tangier in `if __name__ == "__main__":`

## Implementation
### 1) Collection + metadata refactor (required)
1. In `rag.py`, change the collection strategy (choose one):
   - Option A (recommended): single collection for all cities:
     - `collection = client.get_or_create_collection(name="knowledge", ...)`
   - Option B: one collection per city (more complex; skip unless necessary)
2. Add `city` metadata:
   - Update ingestion so each added chunk has metadata:
     - `metadatas=[{ "city": city_name, ... }]`

### 2) Update ingestion API (required)
3. Change/introduce `ingest_data` signature:
   - `def ingest_data(file_path: str, city_name: str) -> None`
4. Update the Chroma delete logic:
   - Instead of deleting only `source="tangier_data.txt"`, delete by city and source:
     - e.g., delete where `source==file basename` AND `city==city_name`
   - If you use a single collection, you must avoid deleting other cities.
5. Ensure chunk metadata still includes category/keywords (existing quality improvements).

### 3) Update querying API (required)
6. Update `query_knowledge` signature:
   - `def query_knowledge(query_text: str, city: str | None = None, n_results: int = 3) -> str`
7. If `city` is provided:
   - apply a Chroma `where` filter:
     - `where={"city": city}`
   - Still retrieve `n_results + 2` then assemble context like today.
8. If `city` is None:
   - keep current assembly behavior but without filtering.
9. Context assembly format:
   - Keep category formatting (`[{CATEGORY}] ...`) but consider city:
     - optional: prefix context with `City: <city>`

### 4) Backward compatibility (required)
10. Existing call sites should still work:
   - `query_knowledge(user_msg)` must behave the same when `city` is not passed.
11. Do not remove `get_knowledge_stats()`; update it to include city breakdown if easy.

## Verification (hard gates)
1. Ingest and query:
   - Ensure running `python backend/app/core/rag.py` (after you update `__main__`) does not error.
2. Backward compatibility:
   - Existing code using `query_knowledge(query_text)` returns a non-empty string for a Tangier query.
3. City filtering:
   - If another city dataset exists, ensure:
     - Querying `city="Marrakech"` returns chunks whose metadata.city == "Marrakech"

## Risk notes
- Chroma `where` filtering requires exact string matches; normalize city names consistently (e.g., title case).
- Changing collection name can invalidate existing persisted data; document whether you want to keep old tangier-only DB or migrate.
