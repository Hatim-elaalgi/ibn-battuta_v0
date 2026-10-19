"""
Lightweight RAG Pipeline Design for Local LLM (LM Studio)

1. Embedding Model:
   - **Recommendation**: `sentence-transformers/all-MiniLM-L6-v2`
   - **Reason**: Extremely fast, low memory footprint (~80MB), and high quality for English semantic search. Perfect for local CPU execution.

2. Vector Database:
   - **Recommendation**: `ChromaDB`
   - **Reason**: 
     - Runs locally (no Docker/cloud needed).
     - Simple Python API.
     - Persists to disk easily (`./chroma_db`).
   
3. Retrieval Method:
   - **Chunking**: Split text by paragraphs or fixed window (e.g., 300 chars with overlap).
   - **Search**: Semantic search using cosine similarity.
   - **Top-K**: Retrieve top 3 chunks to fit into the context window of smaller local models (e.g., Qwen 2.5 7B usually has 32k context, but smaller inputs run faster).

Implementation Plan:
   - Install `chromadb` and `sentence-transformers`.
   - Create a script to ingest `tangier_data.txt` into ChromaDB.
   - Create a helper `retrieve_context(query)` in the backend.
"""
