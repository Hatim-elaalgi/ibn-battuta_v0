#!/usr/bin/env python3
"""
ingest_morocco.py — Populate ChromaDB + SQLite with real Morocco data.

Sources (all free, no API key required):
  1. Wikipedia API   → ChromaDB  : encyclopedic articles per city & landmark
  2. Wikivoyage API  → ChromaDB  : practical travel guides (See/Do/Eat/Sleep)
  3. Overpass API    → SQLite     : real POIs with GPS coordinates

Usage:
  cd backend
  python scripts/ingest_morocco.py              # full run
  python scripts/ingest_morocco.py --dry-run    # show counts, no writes
  python scripts/ingest_morocco.py --no-sql     # skip Overpass → SQL step
  python scripts/ingest_morocco.py --no-rag     # skip Wikipedia/Wikivoyage → ChromaDB
  python scripts/ingest_morocco.py --reset-rag  # wipe Morocco chunks first
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Optional

import requests

# ── Make app modules importable ───────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

import chromadb
from chromadb.utils import embedding_functions
from sqlalchemy import create_engine, text

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")

# ─── Paths ────────────────────────────────────────────────────────────────────
DB_PATH    = ROOT / "app.db"
CHROMA_DIR = ROOT.parent / "chroma_db"

HEADERS = {"User-Agent": "IbnBattutaGuide/2.0 (educational; contact: guide@example.com)"}

# ─── Cities config ────────────────────────────────────────────────────────────
CITIES = [
    {
        "name": "Tangier", "name_ar": "طنجة",
        "region": "Tanger-Tetouan-Al Hoceima",
        "lat": 35.7595, "lon": -5.8340,
        "bbox": (35.68, -5.96, 35.84, -5.72),   # wider box to catch suburbs
        "wikipedia": "Tangier",
        "wikivoyage": "Tangier",
    },
    {
        "name": "Chefchaouen", "name_ar": "شفشاون",
        "region": "Tanger-Tetouan-Al Hoceima",
        "lat": 35.1688, "lon": -5.2636,
        "bbox": (35.13, -5.34, 35.22, -5.22),
        "wikipedia": "Chefchaouen",
        "wikivoyage": "Chefchaouen",
    },
    {
        "name": "Tetouan", "name_ar": "تطوان",
        "region": "Tanger-Tetouan-Al Hoceima",
        "lat": 35.5783, "lon": -5.3750,
        "bbox": (35.54, -5.44, 35.62, -5.31),
        "wikipedia": "Tétouan",      # accented spelling — API redirects handle it
        "wikivoyage": "Tetouan",
    },
    {
        "name": "Asilah", "name_ar": "أصيلة",
        "region": "Tanger-Tetouan-Al Hoceima",
        "lat": 35.4653, "lon": -6.0345,
        "bbox": (35.43, -6.07, 35.50, -5.99),
        "wikipedia": "Asilah",
        "wikivoyage": "Asilah",
    },
    {
        "name": "Fnideq", "name_ar": "الفنيدق",
        "region": "Tanger-Tetouan-Al Hoceima",
        "lat": 35.8492, "lon": -5.3574,
        "bbox": (35.82, -5.40, 35.87, -5.31),
        "wikipedia": "Fnideq",
        "wikivoyage": None,
    },
]

# Extra Wikipedia articles to ingest (city label → article title)
EXTRA_ARTICLES: list[tuple[str, str]] = [
    # Tangier landmarks
    ("Tangier", "Kasbah of Tangier"),
    ("Tangier", "Medina of Tangier"),
    ("Tangier", "American Legation (Tangier)"),
    ("Tangier", "Cap Spartel"),
    ("Tangier", "Hercules Caves"),
    ("Tangier", "Café Hafa"),
    ("Tangier", "Ibn Battuta"),
    ("Tangier", "Tangier International Zone"),
    ("Tangier", "Strait of Gibraltar"),
    # Tetouan landmarks
    ("Tetouan", "Medina of Tetouan"),
    ("Tetouan", "Royal Palace, Tetouan"),
    # Chefchaouen landmarks
    ("Chefchaouen", "Ras el-Maa"),
    # Regional / cultural context
    ("Morocco",  "Morocco"),
    ("Morocco",  "Moroccan cuisine"),
    ("Morocco",  "Amazigh people"),
    ("Morocco",  "Darija"),
    ("Morocco",  "History of Morocco"),
    ("Morocco",  "Rif"),
    ("Morocco",  "Marinid dynasty"),
]

# Overpass: OSM tags that map to place types we care about
OVERPASS_FILTERS = [
    ('["tourism"~"museum|attraction|viewpoint|gallery|artwork|monument"]',  "culture"),
    ('["historic"~"castle|ruins|archaeological_site|building|monument"]',   "culture"),
    ('["natural"~"beach|cliff|cape"]',                                       "coast"),
    ('["amenity"~"place_of_worship"]["religion"="muslim"]',                  "culture"),
]

# Emoji per type
EMOJI_MAP = {
    "culture": "🏛️",
    "coast":   "🌊",
    "nature":  "🌿",
    "day_trip": "🚗",
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_-]+", "-", text).strip("-")


def _get(url: str, params: dict = {}, retries: int = 3, pause: float = 1.2) -> Optional[dict]:
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            if attempt < retries - 1:
                time.sleep(pause * (attempt + 1))
            else:
                log.warning("  GET failed: %s — %s", url[:80], exc)
    return None


def _post(url: str, data: dict, retries: int = 3, pause: float = 2.0) -> Optional[dict]:
    for attempt in range(retries):
        try:
            r = requests.post(url, data=data, headers=HEADERS, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            if attempt < retries - 1:
                time.sleep(pause * (attempt + 1))
            else:
                log.warning("  POST failed: %s — %s", url[:80], exc)
    return None


# ─── Wikipedia ────────────────────────────────────────────────────────────────

def fetch_wikipedia(article_title: str) -> Optional[str]:
    """Return clean plain-text extract from Wikipedia (full article)."""
    data = _get(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "prop": "extracts",
            "titles": article_title,
            "redirects": 1,        # follow Tetouan → Tétouan, etc.
            "explaintext": 1,
            "exsectionformat": "plain",
            "format": "json",
        },
    )
    if not data:
        return None
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("pageid", -1) == -1:
            return None   # page does not exist
        extract = page.get("extract", "").strip()
        return extract if len(extract) > 100 else None
    return None


# ─── Wikivoyage ──────────────────────────────────────────────────────────────

def fetch_wikivoyage(article_title: str) -> Optional[str]:
    """Return plain-text extract from Wikivoyage."""
    data = _get(
        "https://en.wikivoyage.org/w/api.php",
        params={
            "action": "query",
            "prop": "extracts",
            "titles": article_title,
            "redirects": 1,
            "explaintext": 1,
            "exsectionformat": "plain",
            "format": "json",
        },
    )
    if not data:
        return None
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("pageid", -1) == -1:
            return None
        extract = page.get("extract", "").strip()
        return extract if len(extract) > 100 else None
    return None


# ─── Overpass ────────────────────────────────────────────────────────────────

def fetch_overpass_pois(bbox: tuple[float, float, float, float], tag_filter: str) -> list[dict]:
    """Fetch POI nodes from Overpass within a bounding box."""
    lat_min, lon_min, lat_max, lon_max = bbox
    query = (
        f"[out:json][timeout:30];"
        f"("
        f"  node{tag_filter}({lat_min},{lon_min},{lat_max},{lon_max});"
        f"  way{tag_filter}({lat_min},{lon_min},{lat_max},{lon_max});"
        f");"
        f"out center;"
    )
    data = _post("https://overpass-api.de/api/interpreter", {"data": query})
    if not data:
        return []
    results = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        # Prefer English name, fall back to French then default
        name = (
            tags.get("name:en")
            or tags.get("name")
            or tags.get("name:fr")
        )
        if not name or len(name) < 2:
            continue
        # Get coordinates (nodes have lat/lon directly; ways have center)
        center = el.get("center", {})
        lat = el.get("lat") or center.get("lat")
        lon = el.get("lon") or center.get("lon")
        if lat is None or lon is None:
            continue
        results.append({
            "name":     name,
            "name_ar":  tags.get("name:ar"),
            "lat":      float(lat),
            "lon":      float(lon),
            "tags":     tags,
            "wikidata": tags.get("wikidata"),
            "wikipedia": tags.get("wikipedia"),
            "website":  tags.get("website") or tags.get("contact:website"),
            "opening_hours": tags.get("opening_hours"),
        })
    return results


# ─── ChromaDB chunking ────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 400, overlap: int = 60) -> list[str]:
    """
    Split text into overlapping chunks of ~chunk_size characters,
    respecting sentence and paragraph boundaries.
    """
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        # If para alone exceeds chunk_size, split at sentence boundaries
        if len(para) > chunk_size:
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for sent in sentences:
                if len(current) + len(sent) > chunk_size and current:
                    chunks.append(current.strip())
                    # Keep overlap
                    words = current.split()
                    current = " ".join(words[-max(1, overlap // 6):]) + " " + sent
                else:
                    current += (" " if current else "") + sent
        else:
            if len(current) + len(para) > chunk_size and current:
                chunks.append(current.strip())
                words = current.split()
                current = " ".join(words[-max(1, overlap // 6):]) + "\n" + para
            else:
                current += ("\n" if current else "") + para

    if current.strip() and len(current.strip()) > 30:
        chunks.append(current.strip())
    return [c for c in chunks if len(c) > 40]


def ingest_text_to_chroma(
    collection,
    text: str,
    city: str,
    source: str,      # "wikipedia" | "wikivoyage"
    article: str,     # article title
    dry_run: bool,
) -> int:
    """Chunk text and upsert into ChromaDB. Returns number of chunks."""
    chunks = chunk_text(text)
    if not chunks:
        return 0

    city_slug    = slugify(city)
    article_slug = slugify(article)
    ids          = [f"{source}-{city_slug}-{article_slug}-{i:04d}" for i in range(len(chunks))]
    metadatas    = [
        {
            "city":    city,
            "source":  source,
            "article": article,
            "chunk":   str(i),
        }
        for i in range(len(chunks))
    ]

    if not dry_run:
        collection.upsert(documents=chunks, ids=ids, metadatas=metadatas)
    return len(chunks)


# ─── SQLite upsert ────────────────────────────────────────────────────────────

_SUBTYPE_DESC = {
    # tourism
    "museum":       "Museum",
    "attraction":   "Attraction",
    "viewpoint":    "Viewpoint with panoramic views",
    "gallery":      "Art gallery",
    "artwork":      "Public artwork",
    "monument":     "Historic monument",
    # historic
    "castle":       "Historic castle or fortress",
    "ruins":        "Archaeological ruins",
    "archaeological_site": "Archaeological site",
    "building":     "Historic building",
    # natural
    "beach":        "Beach",
    "cliff":        "Sea cliff",
    "cape":         "Cape with sea views",
    # amenity
    "place_of_worship": "Mosque",
}


def _derive_short_desc(tags: dict, place_type: str) -> str:
    subtype = (
        tags.get("tourism") or tags.get("historic")
        or tags.get("natural") or tags.get("amenity") or ""
    )
    base = _SUBTYPE_DESC.get(subtype, place_type.replace("_", " ").title())
    # Add neighbourhood if available
    neighbourhood = tags.get("addr:suburb") or tags.get("neighbourhood") or tags.get("district")
    if neighbourhood:
        return f"{base} in {neighbourhood}"
    return base


def upsert_place(db_engine, city: str, region: str, place_type: str, poi: dict, dry_run: bool) -> bool:
    """
    Insert a POI into the places table.
    Skips if a row with the same slug already exists.
    Returns True if inserted.
    """
    name  = poi["name"]
    slug  = slugify(city) + "-" + slugify(name)

    with db_engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM places WHERE slug = :slug"),
            {"slug": slug},
        ).fetchone()
        if existing:
            return False

        if dry_run:
            return True  # would insert

        tags      = poi.get("tags", {})
        must_see  = bool(poi.get("wikidata") or poi.get("wikipedia"))
        emoji     = EMOJI_MAP.get(place_type, "◇")
        short_desc = _derive_short_desc(tags, place_type)
        conn.execute(
            text("""
                INSERT INTO places
                  (slug, name, name_ar, city, region, type, subtype,
                   lat, lon, short_desc, description, emoji, tags,
                   hidden_gem, must_see, avg_visit_minutes, price_tier)
                VALUES
                  (:slug, :name, :name_ar, :city, :region, :type, :subtype,
                   :lat, :lon, :short_desc, :description, :emoji, '[]',
                   0, :must_see, 60, NULL)
            """),
            {
                "slug":        slug,
                "name":        name,
                "name_ar":     poi.get("name_ar"),
                "city":        city,
                "region":      region,
                "type":        place_type,
                "subtype":     (tags.get("tourism") or tags.get("historic")
                                or tags.get("natural") or tags.get("amenity")),
                "lat":         poi["lat"],
                "lon":         poi["lon"],
                "short_desc":  short_desc,
                "description": None,
                "emoji":       emoji,
                "must_see":    1 if must_see else 0,
            },
        )
        conn.commit()
    return True


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Ingest Morocco data into ChromaDB + SQLite")
    parser.add_argument("--dry-run",     action="store_true", help="Show stats without writing")
    parser.add_argument("--no-sql",      action="store_true", help="Skip Overpass → SQLite step")
    parser.add_argument("--no-rag",      action="store_true", help="Skip Wikipedia/Wikivoyage → ChromaDB")
    parser.add_argument("--reset-rag",   action="store_true", help="Delete existing Morocco chunks before re-ingesting")
    parser.add_argument("--cities",      nargs="+",           help="Limit to specific city names")
    args = parser.parse_args()

    dry = args.dry_run
    if dry:
        log.info("DRY RUN — nothing will be written")

    # ── Filter cities ─────────────────────────────────────────────────────────
    cities = CITIES
    if args.cities:
        wanted = {c.lower() for c in args.cities}
        cities = [c for c in CITIES if c["name"].lower() in wanted]
        if not cities:
            log.error("No matching cities found. Available: %s", [c["name"] for c in CITIES])
            sys.exit(1)

    total_chunks  = 0
    total_places  = 0

    # ── ChromaDB setup ────────────────────────────────────────────────────────
    if not args.no_rag:
        log.info("Connecting to ChromaDB at %s", CHROMA_DIR)
        chroma = chromadb.PersistentClient(path=str(CHROMA_DIR))
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        coll = chroma.get_or_create_collection(name="knowledge", embedding_function=ef)

        if args.reset_rag and not dry:
            log.info("Deleting existing Morocco chunks …")
            for city in cities:
                try:
                    coll.delete(where={"city": city["name"]})
                    log.info("  Deleted chunks for %s", city["name"])
                except Exception as e:
                    log.warning("  Could not delete %s: %s", city["name"], e)

        # ── Per-city Wikipedia + Wikivoyage ───────────────────────────────────
        for city in cities:
            log.info("── %s ─────────────────────────────────────────", city["name"])

            # Wikipedia city article
            log.info("  Wikipedia: %s …", city["wikipedia"])
            text = fetch_wikipedia(city["wikipedia"])
            if text:
                n = ingest_text_to_chroma(coll, text, city["name"], "wikipedia", city["wikipedia"], dry)
                log.info("    → %d chunks", n)
                total_chunks += n
            else:
                log.warning("    No Wikipedia article found")
            time.sleep(0.5)

            # Wikivoyage city guide
            if city.get("wikivoyage"):
                log.info("  Wikivoyage: %s …", city["wikivoyage"])
                text = fetch_wikivoyage(city["wikivoyage"])
                if text:
                    n = ingest_text_to_chroma(coll, text, city["name"], "wikivoyage", city["wikivoyage"], dry)
                    log.info("    → %d chunks", n)
                    total_chunks += n
                else:
                    log.warning("    No Wikivoyage article found")
                time.sleep(0.5)

        # ── Extra Wikipedia articles (landmarks + culture) ────────────────────
        log.info("── Extra Wikipedia articles ────────────────────────────────")
        for city_label, article_title in EXTRA_ARTICLES:
            # Only ingest if this city is in our filtered list (or city_label is "Morocco")
            if city_label != "Morocco":
                city_names = [c["name"] for c in cities]
                if city_label not in city_names:
                    continue
            log.info("  %s / %s …", city_label, article_title)
            text = fetch_wikipedia(article_title)
            if text:
                n = ingest_text_to_chroma(coll, text, city_label, "wikipedia", article_title, dry)
                log.info("    → %d chunks", n)
                total_chunks += n
            else:
                log.warning("    Not found")
            time.sleep(0.6)

        log.info("ChromaDB: %d total chunks ingested", total_chunks)

    # ── Overpass → SQLite ─────────────────────────────────────────────────────
    if not args.no_sql:
        if not DB_PATH.exists():
            log.error("SQLite DB not found at %s. Run the backend first to create tables.", DB_PATH)
            sys.exit(1)

        engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
        log.info("── Overpass → SQLite (%s) ──────────────────────────────────", DB_PATH.name)

        for city in cities:
            log.info("  %s — fetching POIs …", city["name"])
            city_total = 0

            for tag_filter, place_type in OVERPASS_FILTERS:
                pois = fetch_overpass_pois(city["bbox"], tag_filter)
                inserted = 0
                for poi in pois:
                    ok = upsert_place(engine, city["name"], city["region"], place_type, poi, dry)
                    if ok:
                        inserted += 1
                if pois:
                    log.info("    %s [%s]: %d fetched, %d new",
                             place_type, tag_filter[2:20] + "…", len(pois), inserted)
                city_total += inserted
                time.sleep(1.5)  # be polite to Overpass

            log.info("  %s total new rows: %d", city["name"], city_total)
            total_places += city_total

        log.info("SQLite: %d total new places inserted", total_places)

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("")
    log.info("═══════════════════ Done ═══════════════════")
    if not args.no_rag:
        log.info("  ChromaDB chunks : %d  %s", total_chunks, "(dry)" if dry else "")
    if not args.no_sql:
        log.info("  SQLite places   : %d  %s", total_places, "(dry)" if dry else "")
    log.info("════════════════════════════════════════════")

    # ── Quick ChromaDB stats ──────────────────────────────────────────────────
    if not args.no_rag and not dry:
        try:
            chroma2 = chromadb.PersistentClient(path=str(CHROMA_DIR))
            ef2 = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
            coll2 = chroma2.get_or_create_collection(name="knowledge", embedding_function=ef2)
            total_db = coll2.count()
            log.info("  ChromaDB total  : %d chunks across all cities", total_db)
        except Exception:
            pass

    if not args.no_sql and not dry:
        try:
            with engine.connect() as conn:
                row = conn.execute(text("SELECT city, COUNT(*) as n FROM places GROUP BY city ORDER BY n DESC")).fetchall()
                log.info("  Places by city  :")
                for r in row:
                    log.info("    %-20s %d", r[0], r[1])
        except Exception:
            pass


if __name__ == "__main__":
    main()
