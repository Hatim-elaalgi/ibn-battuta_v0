import chromadb
from chromadb.utils import embedding_functions
import os
import re
import glob
from typing import List, Dict, Optional

# Define path for persistent storage
DB_DIR = os.path.join(os.path.dirname(__file__), "../../../chroma_db")

# Initialize ChromaDB client with persistent storage
client = chromadb.PersistentClient(path=DB_DIR)

# Lightweight, high-quality embedding model
ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

# Single unified collection for all cities
collection = client.get_or_create_collection(name="knowledge", embedding_function=ef)


# ─── Metadata helpers ─────────────────────────────────────────────────────────

def extract_category(text: str) -> str:
    """Extract category from section header line."""
    for line in text.split('\n'):
        if line.startswith('---') and line.endswith('---'):
            return line.strip('-').strip().lower().replace(' ', '_')
    return "general"

def extract_keywords(text: str, city_name: str = "") -> List[str]:
    """Extract important keywords for better filtering."""
    keywords = []
    lower_text = text.lower()

    # Generic POI/activity words
    locations = [
        'kasbah', 'socco', 'medina', 'corniche', 'hercules', 'cape spartel',
        'american legation', 'café hafa', 'perdicaris', 'lighthouse', 'strait',
        'koutoubia', 'jemaa el-fna', 'bahia', 'majorelle', 'saadian', 'atlas',
        'arc de triomphe', 'eiffel', 'louvre', 'seine', 'montmartre',
        'colosseum', 'vatican', 'trevi', 'forum', 'pantheon',
        'sagrada', 'park güell', 'las ramblas', 'born',
        'hagia sophia', 'topkapi', 'bosphorus', 'grand bazaar',
        'burj khalifa', 'dubai mall', 'creek', 'gold souk',
        'pyramids', 'sphinx', 'khan el-khalili', 'nile', 'citadel',
    ]
    activities = [
        'visit', 'walking', 'hiking', 'cafe', 'museum', 'sea views',
        'seafood', 'history', 'architecture', 'shopping', 'souk',
        'hammam', 'riad', 'tour', 'sunset', 'night market',
    ]

    for loc in locations:
        if loc in lower_text:
            keywords.append(f"location_{loc.replace(' ', '_')}")

    for act in activities:
        if act in lower_text:
            keywords.append(f"activity_{act}")

    if city_name:
        keywords.append(f"city_{city_name.lower()}")

    return keywords


def semantic_chunk(text: str, city_name: str = "", chunk_size: int = 300, overlap: int = 50) -> List[Dict]:
    """
    Improved chunking with semantic awareness and overlapping windows.
    Respects section boundaries; metadata includes city.
    """
    chunks_with_meta = []
    sections = re.split(r'--- .* ---', text)

    for section in sections:
        if not section.strip():
            continue

        category = extract_category(section)
        keywords = extract_keywords(section, city_name)

        words = section.split()
        current_chunk: List[str] = []

        for word in words:
            current_chunk.append(word)
            chunk_text = ' '.join(current_chunk)

            if len(chunk_text) >= chunk_size:
                chunks_with_meta.append({
                    'text': chunk_text.strip(),
                    'category': category,
                    'keywords': keywords,
                    'length': len(chunk_text),
                })
                overlap_words = max(5, len(current_chunk) // 4)
                current_chunk = current_chunk[-overlap_words:]

        if current_chunk:
            chunk_text = ' '.join(current_chunk).strip()
            if len(chunk_text) > 20:
                chunks_with_meta.append({
                    'text': chunk_text,
                    'category': category,
                    'keywords': keywords,
                    'length': len(chunk_text),
                })

    return chunks_with_meta


# ─── Ingestion ────────────────────────────────────────────────────────────────

def ingest_data(file_path: str, city_name: str) -> None:
    """
    Read a text file, apply semantic chunking with city metadata,
    and store chunks in the unified ChromaDB collection.
    Deletes only existing chunks for this city+source before re-inserting.
    """
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    source_name = os.path.basename(file_path)
    city_norm   = city_name.strip().title()  # e.g. "Marrakech"

    # Delete existing chunks for this city+source (city-scoped, won't touch others)
    try:
        collection.delete(where={"$and": [{"city": city_norm}, {"source": source_name}]})
    except Exception:
        pass

    chunks_with_meta = semantic_chunk(text, city_name=city_norm)

    # Prefix IDs with city to keep them unique across cities
    city_slug = city_norm.lower().replace(" ", "_")
    ids = [f"{city_slug}_{i}" for i in range(len(chunks_with_meta))]
    documents = [c['text'] for c in chunks_with_meta]
    metadatas = [
        {
            "city":       city_norm,
            "source":     source_name,
            "category":   c['category'],
            "keywords":   ",".join(c['keywords']) if c['keywords'] else "general",
            "chunk_size": str(c['length']),
        }
        for c in chunks_with_meta
    ]

    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    avg_size = sum(c['length'] for c in chunks_with_meta) // max(len(chunks_with_meta), 1)
    print(f"✓ [{city_norm}] Ingested {len(chunks_with_meta)} chunks from {source_name} (avg {avg_size} chars)")


# ─── Querying ─────────────────────────────────────────────────────────────────

def query_knowledge(query_text: str, city: Optional[str] = None, n_results: int = 3) -> str:
    """
    Query the knowledge base, optionally filtered by city.

    Args:
        query_text: User question/message.
        city: Optional city name to restrict results (exact match, title case).
        n_results: Number of top chunks to assemble into context.

    Returns:
        Formatted context string, or "" if nothing found.
    """
    try:
        fetch_n = min(n_results + 2, 10)
        city_norm = city.strip().title() if city else None

        query_kwargs: Dict = dict(
            query_texts=[query_text],
            n_results=fetch_n,
            include=['documents', 'metadatas', 'distances'],
        )
        if city_norm:
            query_kwargs["where"] = {"city": city_norm}

        results = collection.query(**query_kwargs)

        if not results["documents"] or not results["documents"][0]:
            # Fall back to unfiltered search if city filter returned nothing
            if city_norm:
                results = collection.query(
                    query_texts=[query_text],
                    n_results=fetch_n,
                    include=['documents', 'metadatas', 'distances'],
                )
            if not results["documents"] or not results["documents"][0]:
                return ""

        scored = sorted(
            zip(results["documents"][0], results["distances"][0], results["metadatas"][0]),
            key=lambda x: x[1],
        )[:n_results]

        context_parts = []
        for doc, _, meta in scored:
            cat = meta.get('category', 'general')
            city_tag = meta.get('city', '')
            prefix = f"[{cat.upper()}]" if cat != 'general' else ""
            city_prefix = f"City: {city_tag} | " if city_tag else ""
            context_parts.append(f"{city_prefix}{prefix} {doc}".strip())

        return "\n\n".join(context_parts)

    except Exception as e:
        print(f"Query error: {e}")
        return ""


# ─── Stats ────────────────────────────────────────────────────────────────────

def get_knowledge_stats() -> Dict:
    """Return stats including per-city chunk counts."""
    try:
        total = collection.count()
        # Sample up to 1000 to count by city
        sample = collection.get(limit=1000, include=['metadatas'])
        city_counts: Dict[str, int] = {}
        for meta in sample.get('metadatas', []):
            c = meta.get('city', 'unknown')
            city_counts[c] = city_counts.get(c, 0) + 1
        return {
            "total_chunks": total,
            "collection": "knowledge",
            "embedding_model": "all-MiniLM-L6-v2",
            "cities": city_counts,
            "status": "ok",
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ─── Runner ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    data_dir = os.path.join(os.path.dirname(__file__), "../data")
    data_files = glob.glob(os.path.join(data_dir, "*_data.txt"))

    if not data_files:
        print("No *_data.txt files found in backend/app/data/")
    else:
        for fpath in sorted(data_files):
            # Derive city name from filename: marrakech_data.txt → Marrakech
            basename = os.path.basename(fpath)                 # marrakech_data.txt
            city_slug = basename.replace("_data.txt", "")      # marrakech
            city_name = city_slug.replace("_", " ").title()    # Marrakech
            ingest_data(fpath, city_name)

    stats = get_knowledge_stats()
    print(f"\nKnowledge Base Stats:")
    print(f"  Total chunks : {stats.get('total_chunks', 0)}")
    print(f"  Cities       : {stats.get('cities', {})}")
