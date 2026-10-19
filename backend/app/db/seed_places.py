"""
Bootstrap seed for the `places` table.

The 16 entries below are copy-pasted from
frontend/src/components/map/TangierMap.jsx (LANDMARKS, lines 53-157).
Idempotent — runs once on first boot when the table is empty.
"""
import logging
from sqlalchemy.orm import Session

from app.models import Place

logger = logging.getLogger(__name__)


# ── Source data ─────────────────────────────────────────────────────────────
# Shape: { lat, lon, emoji, name, sub, desc, cat }
_LANDMARKS: list[dict] = [
    # Medina & Culture
    {
        "lat": 35.7847, "lon": -5.8060, "emoji": "☕",
        "name": "Petit Socco", "sub": "Place Souk Dakhel",
        "desc": "Atmospheric little square deep in the Medina — once the literary haunt of Paul Bowles and William Burroughs.",
        "cat":  "Medina & Culture",
    },
    {
        "lat": 35.7888, "lon": -5.8118, "emoji": "🏰",
        "name": "Kasbah Museum", "sub": "Dar el-Makhzen",
        "desc": "Former sultan's palace turned museum of Moroccan arts. Panoramic views over the Strait of Gibraltar.",
        "cat":  "Medina & Culture",
    },
    {
        "lat": 35.7840, "lon": -5.8055, "emoji": "🎖️",
        "name": "American Legation", "sub": "TALIM Museum",
        "desc": "The only US National Historic Landmark outside the United States — Morocco's gift to America in 1821.",
        "cat":  "Medina & Culture",
    },
    {
        "lat": 35.7795, "lon": -5.8083, "emoji": "🎬",
        "name": "Cinéma Rif", "sub": "Grand Socco",
        "desc": "Iconic 1938 art-déco cinema on Grand Socco — home of the Tangier International Film Festival.",
        "cat":  "Medina & Culture",
    },
    {
        "lat": 35.7797, "lon": -5.8101, "emoji": "🌳",
        "name": "Mendoubia Gardens", "sub": "Jardin du Mendoubia",
        "desc": "Lush gardens sheltering an 800-year-old dragon tree and monuments to Moroccan independence.",
        "cat":  "Medina & Culture",
    },
    {
        "lat": 35.7779, "lon": -5.8086, "emoji": "🏨",
        "name": "Hôtel El Minzah", "sub": "Historic 1930 landmark",
        "desc": "Legendary hotel that hosted Churchill, Matisse and Onassis — the symbol of Tangier's cosmopolitan golden age.",
        "cat":  "Medina & Culture",
    },

    # Coast & Port
    {
        "lat": 35.8060, "lon": -5.8125, "emoji": "⚓",
        "name": "Tangier Port", "sub": "Ferry terminal",
        "desc": "Gateway between Africa and Europe — ferries depart across the 14 km Strait of Gibraltar to Spain.",
        "cat":  "Coast & Port",
    },
    {
        "lat": 35.7762, "lon": -5.7889, "emoji": "🏖️",
        "name": "Tangier Beach", "sub": "Plage de Tangier",
        "desc": "Wide sandy beach stretching east along the bay — Tangier's favourite promenade and seafront.",
        "cat":  "Coast & Port",
    },
    {
        "lat": 35.8126, "lon": -5.7552, "emoji": "🔦",
        "name": "Cap Malabata", "sub": "Lighthouse & beach",
        "desc": "Scenic lighthouse headland east of the city with sweeping views of Gibraltar and the Spanish coast.",
        "cat":  "Coast & Port",
    },

    # Nature & Viewpoints
    {
        "lat": 35.7921, "lon": -5.9234, "emoji": "🌊",
        "name": "Cap Spartel", "sub": "Atlantic meets Mediterranean",
        "desc": "The north-westernmost tip of Africa — the precise point where two great seas merge.",
        "cat":  "Nature & Viewpoints",
    },
    {
        "lat": 35.7803, "lon": -5.9285, "emoji": "🗿",
        "name": "Grottes d'Hercule", "sub": "Caves of Hercules",
        "desc": "Mythological sea-cave whose Atlantic opening mirrors the outline of Africa. Legend says Hercules rested here.",
        "cat":  "Nature & Viewpoints",
    },
    {
        "lat": 35.7682, "lon": -5.9052, "emoji": "🏝️",
        "name": "Achakkar Beach", "sub": "Wild Atlantic coast",
        "desc": "Open Atlantic beach just south of Cap Spartel — dunes, crashing waves, almost no crowds.",
        "cat":  "Nature & Viewpoints",
    },

    # Day Trips
    {
        "lat": 35.4664, "lon": -6.0352, "emoji": "🎨",
        "name": "Asilah", "sub": "45 km south",
        "desc": "Fortified coastal town known for its whitewashed medina, annual open-air mural festival and superb seafood.",
        "cat":  "Day Trips",
    },
    {
        "lat": 35.5706, "lon": -5.3683, "emoji": "🕌",
        "name": "Tetouan", "sub": "60 km east — UNESCO Medina",
        "desc": "UNESCO World Heritage medina with Andalusian architecture — considered the most authentic in northern Morocco.",
        "cat":  "Day Trips",
    },
    {
        "lat": 35.1714, "lon": -5.2681, "emoji": "💙",
        "name": "Chefchaouen", "sub": "110 km SE — The Blue City",
        "desc": "Morocco's most photographed city — every alley painted in shades of blue, nestled high in the Rif Mountains.",
        "cat":  "Day Trips",
    },
    {
        "lat": 35.8499, "lon": -5.3521, "emoji": "🛂",
        "name": "Fnideq / Ceuta", "sub": "35 km east — border crossing",
        "desc": "Gateway to the Spanish enclave of Ceuta (Sebta) — an interesting border town with duty-free commerce.",
        "cat":  "Day Trips",
    },
]

# Frontend `cat` → DB `type`
CAT_TO_TYPE = {
    "Medina & Culture":    "culture",
    "Coast & Port":        "coast",
    "Nature & Viewpoints": "nature",
    "Day Trips":           "day_trip",
}

# Day-trip name → real city. Everything else lives in Tangier.
DAY_TRIP_CITY = {
    "Asilah":         "Asilah",
    "Tetouan":        "Tetouan",
    "Chefchaouen":    "Chefchaouen",
    "Fnideq / Ceuta": "Fnideq",
}


def _slugify(s: str) -> str:
    return (
        s.lower()
         .replace("'", "")
         .replace("/", "-")
         .replace(" — ", "-")
         .replace("—", "-")
         .replace(".", "")
         .replace(",", "")
         .replace("&", "and")
         .replace(" ", "-")
         .strip("-")
    )


def seed_places_if_empty(db: Session) -> int:
    """Insert the 16 landmarks if the table is empty. Returns inserted count."""
    if db.query(Place).count() > 0:
        return 0

    rows = []
    for entry in _LANDMARKS:
        cat = entry["cat"]
        city = DAY_TRIP_CITY.get(entry["name"], "Tangier")
        rows.append(Place(
            slug         = f"{_slugify(city)}-{_slugify(entry['name'])}",
            name         = entry["name"],
            city         = city,
            lat          = entry["lat"],
            lon          = entry["lon"],
            type         = CAT_TO_TYPE[cat],
            subtype      = cat,
            short_desc   = entry["sub"],
            description  = entry["desc"],
            emoji        = entry["emoji"],
            tags         = [],
            hidden_gem   = False,
            must_see     = (city == "Tangier"),
            avg_visit_minutes = 60,
        ))

    db.add_all(rows)
    db.commit()
    n = len(rows)
    logger.info("[seed] inserted %d places", n)
    return n
