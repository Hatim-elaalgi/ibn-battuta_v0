"""
3-pass LLM pipeline for generating an itinerary, with progress callbacks.

Pass 1 — Plan:        prefs ──▶  LLM  ──▶  { title, days: [{day, city, theme}, ...] }
Pass 2 — Selection:   for each day, query candidate Places from DB, ask LLM to
                       pick & order 3-5 by place_id with start_time + duration
Pass 3 — Narration:   per-day batch, LLM produces a 1-line day summary +
                       60-110 word voice-of-Ibn-Battuta paragraph for each stop

Each phase calls a `progress(event_type, payload)` callback so the SSE handler
can stream events to the client as they arrive.
"""
from __future__ import annotations

import logging
from typing import Callable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.llm import call_local_llm_json
from app.core.rag import query_knowledge
from app.models import Place

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════════════
# City helpers
# ════════════════════════════════════════════════════════════════════════════

def _normalize_city(llm_city: str, known_cities: list[str], fallback: str) -> str:
    """
    Map an LLM-returned city name to an exact DB city name.
    Tries exact match first, then case-insensitive, then returns fallback.
    """
    if llm_city in known_cities:
        return llm_city
    lower_map = {c.lower(): c for c in known_cities}
    return lower_map.get(llm_city.lower().strip(), fallback)


def _distinct_cities(db: Session) -> list[str]:
    rows = db.query(Place.city).distinct().all()
    return [r[0] for r in rows if r[0]]


# ════════════════════════════════════════════════════════════════════════════
# PASS 1 — High-level plan
# ════════════════════════════════════════════════════════════════════════════

_PLAN_SYSTEM = """You plan tourist itineraries in Morocco.
You speak in the spirit of Ibn Battuta, the medieval traveller — reflective, present-tense, never marketing-speak.
Output only valid JSON conforming to the schema given by the user."""

_PLAN_TEMPLATE = """Plan a {num_days}-day trip starting in {start_city}, Morocco.

Traveller profile:
- Party size: {party_size}
- Pace: {pace}              (slow / balanced / packed)
- Budget tier: {budget}     (budget / mid / splurge)
- Interests: {interests}
- Notes: {notes}

IMPORTANT — use ONLY these city names, spelled exactly as written:
{cities_list}

Return JSON with this exact shape:
{{
  "title": "<5-9 word editorial title for the whole trip>",
  "days": [
    {{ "day": 1, "city": "<city from list above>", "theme": "<2-5 word day theme>" }},
    ...
  ]
}}

Rules:
- Day 1 MUST be in {start_city}.
- Every "city" value MUST be copied verbatim from the list above — no other cities.
- For trips of 1-2 days, keep ALL days in {start_city}.
- Day cities should flow logically — no back-and-forth city-hopping.
- Themes are short, specific to that city and the user's interests.
- Return exactly {num_days} day objects.
- NEVER write a city name not present in the list."""


def pass_plan(
    *,
    start_city: str,
    num_days: int,
    party_size: int,
    pace: str,
    budget: str,
    interests: list[str],
    notes: str,
    available_cities: list[str],
) -> dict:
    # RAG context for start city
    city_ctx = ""
    try:
        raw = query_knowledge(
            f"{start_city} overview geography culture history highlights",
            city=start_city, n_results=2,
        )
        if raw:
            city_ctx = f"\n\nContext about {start_city} (background only — do not copy verbatim):\n{raw[:500]}"
    except Exception:
        pass

    # For multi-day trips, also fetch brief context for secondary cities
    if num_days >= 3 and len(available_cities) > 1:
        for nc in [c for c in available_cities if c != start_city][:2]:
            try:
                raw = query_knowledge(f"{nc} travel highlights visit", city=nc, n_results=1)
                if raw:
                    city_ctx += f"\n\nContext about {nc}:\n{raw[:250]}"
            except Exception:
                pass

    user_msg = _PLAN_TEMPLATE.format(
        num_days    = num_days,
        start_city  = start_city,
        party_size  = party_size,
        pace        = pace,
        budget      = budget,
        interests   = ", ".join(interests) or "general culture",
        notes       = notes or "(none)",
        cities_list = "\n".join(f"  - {c}" for c in available_cities),
    ) + city_ctx

    plan = call_local_llm_json(
        user_msg, system_prompt=_PLAN_SYSTEM, max_output_tokens=600, temperature=0.5
    )

    if not isinstance(plan, dict) or "days" not in plan:
        raise ValueError(f"Plan output malformed: {plan!r}")

    # Pad or trim to exact num_days
    if len(plan["days"]) > num_days:
        plan["days"] = plan["days"][:num_days]
    else:
        for i in range(len(plan["days"]), num_days):
            plan["days"].append({"day": i + 1, "city": start_city, "theme": "Free day"})

    # ── Normalize ALL city names to exact DB values ──────────────────────────
    for entry in plan["days"]:
        raw_city = entry.get("city", start_city)
        entry["city"] = _normalize_city(raw_city, available_cities, start_city)

    # Day 1 is always the start city — non-negotiable
    plan["days"][0]["city"] = start_city

    return plan


# ════════════════════════════════════════════════════════════════════════════
# PASS 2 — Stop selection (per day)
# ════════════════════════════════════════════════════════════════════════════

_SELECT_SYSTEM = """You curate visit programmes for a Moroccan travel platform.
You ALWAYS pick from the candidate list provided — never invent places.
Output only valid JSON."""

_SELECT_TEMPLATE = """Build day {day_number} of the trip.

City: {city}
Theme: {theme}
Pace: {pace}   ({slots_hint})
Budget: {budget}
Interests: {interests}
{context_block}
Candidate places — ONLY use these IDs:
{candidates}

Return JSON:
{{
  "stops": [
    {{ "place_id": <int>, "start_time": "HH:MM", "duration_minutes": <int>, "order_index": 0 }},
    ...
  ]
}}

Rules:
- Pick {min_stops}-{max_stops} stops. ONLY use place_id values listed above.
- Order stops by start_time (order_index 0 = earliest).
- Spread start_times between 09:00 and 19:00 with ≥15 min travel gaps and a lunch break.
- Match stops to the theme and interests as closely as possible.
- Prefer [must-see] places; include at most one [hidden gem] per day.
- If budget is "budget", prefer [price:free] or [price:cheap] places.
- Slow pace → fewer stops (longer visit each). Packed → more stops (shorter each)."""


PACE_HINTS = {
    "slow":     {"min": 2, "max": 3, "hint": "fewer stops, deeper at each"},
    "balanced": {"min": 3, "max": 4, "hint": "a comfortable rhythm"},
    "packed":   {"min": 4, "max": 5, "hint": "see as much as possible"},
}

# Maps user-declared interests to Place.type values
INTEREST_TO_TYPES: dict[str, list[str]] = {
    "history":              ["culture"],
    "culture":              ["culture"],
    "architecture":         ["culture"],
    "art":                  ["culture"],
    "souks":                ["culture"],
    "medina":               ["culture"],
    "shopping":             ["culture"],
    "spiritual":            ["culture"],
    "religion":             ["culture"],
    "nightlife":            ["culture"],
    "food":                 ["culture", "coast"],
    "seafood":              ["coast"],
    "nature":               ["nature", "coast"],
    "beach":                ["coast"],
    "sea":                  ["coast"],
    "ocean":                ["coast"],
    "viewpoint":            ["nature"],
    "panorama":             ["nature"],
    "photography":          ["nature", "coast", "culture"],
    "hiking":               ["nature"],
    "relaxation":           ["coast", "nature"],
    "day_trip":             ["day_trip"],
    "excursion":            ["day_trip"],
}

_PRICE_LABELS = {0: "free", 1: "cheap", 2: "mid", 3: "high"}


def fetch_candidates(
    db: Session,
    city: str,
    interests: list[str],
    budget: str = "mid",
    limit: int = 20,
) -> list[Place]:
    """
    Fetch up to `limit` Place rows for a city.
    Prioritises must_see, then interest-matching types.
    Falls back to case-insensitive city match if exact match returns nothing.
    """
    q = db.query(Place).filter(Place.city == city)

    # Case-insensitive fallback (guards against LLM returning "tangier" vs "Tangier")
    if q.count() == 0:
        logger.warning("No places for city=%r (exact), trying case-insensitive", city)
        q = db.query(Place).filter(func.lower(Place.city) == city.lower())

    # Budget: exclude price_tier 3 for budget travellers
    if budget == "budget":
        q = q.filter((Place.price_tier == None) | (Place.price_tier <= 1))  # noqa: E711

    # Resolve interests → type pool
    type_pool: set[str] = set()
    want_hidden = False
    for interest in interests:
        key = interest.lower().strip()
        if key in ("hidden_gems", "hidden gems", "off the beaten path", "gems"):
            want_hidden = True
        elif key in INTEREST_TO_TYPES:
            type_pool.update(INTEREST_TO_TYPES[key])

    # Fetch 2× limit so we have headroom for re-ranking
    rows: list[Place] = q.order_by(
        Place.must_see.desc(),
        Place.hidden_gem.desc() if want_hidden else Place.name,
        Place.name,
    ).limit(limit * 2).all()

    # Re-rank: interest-matching types float to the top
    if type_pool:
        matched   = [r for r in rows if r.type in type_pool]
        unmatched = [r for r in rows if r.type not in type_pool]
        rows = (matched + unmatched)

    return rows[:limit]


def pass_select(
    *,
    day_number: int,
    city: str,
    theme: str,
    pace: str,
    budget: str,
    interests: list[str],
    candidates: list[Place],
) -> list[dict]:
    if not candidates:
        return []

    # RAG snippet for this city + theme to give context to the selection LLM
    context_block = ""
    try:
        snippet = query_knowledge(
            f"{theme} {city} best places attractions visit", city=city, n_results=2
        )
        if snippet:
            context_block = f"Local context for '{theme}':\n{snippet[:400]}\n"
    except Exception:
        pass

    cand_lines = []
    for p in candidates:
        desc = (p.short_desc or p.description or "")[:120]
        line = f"- ID {p.id}: {p.name} ({p.type})"
        if p.emoji:
            line += f" {p.emoji}"
        if desc:
            line += f" — {desc}"
        if p.must_see:
            line += " [must-see]"
        if p.hidden_gem:
            line += " [hidden gem]"
        if p.price_tier is not None:
            line += f" [price:{_PRICE_LABELS.get(p.price_tier, '?')}]"
        if p.best_time_of_day:
            line += f" [best:{p.best_time_of_day}]"
        if p.avg_visit_minutes:
            line += f" [~{p.avg_visit_minutes}min]"
        cand_lines.append(line)

    pace_cfg = PACE_HINTS.get(pace, PACE_HINTS["balanced"])
    user_msg = _SELECT_TEMPLATE.format(
        day_number    = day_number,
        city          = city,
        theme         = theme,
        pace          = pace,
        budget        = budget,
        slots_hint    = pace_cfg["hint"],
        interests     = ", ".join(interests) or "general culture",
        context_block = (context_block + "\n") if context_block else "",
        candidates    = "\n".join(cand_lines),
        min_stops     = pace_cfg["min"],
        max_stops     = pace_cfg["max"],
    )
    out = call_local_llm_json(
        user_msg, system_prompt=_SELECT_SYSTEM, max_output_tokens=600, temperature=0.5
    )

    if not isinstance(out, dict) or "stops" not in out:
        raise ValueError(f"Selection malformed: {out!r}")

    valid_ids = {p.id for p in candidates}
    cleaned = []
    for i, s in enumerate(out["stops"]):
        pid = s.get("place_id")
        if not isinstance(pid, int) or pid not in valid_ids:
            logger.warning("Selection returned invalid place_id=%r (valid: %s)", pid, sorted(valid_ids))
            continue
        cleaned.append({
            "place_id":         pid,
            "start_time":       s.get("start_time", "10:00"),
            "duration_minutes": int(s.get("duration_minutes", 60)),
            "order_index":      int(s.get("order_index", i)),
        })
    cleaned.sort(key=lambda x: x["order_index"])
    return cleaned


# ════════════════════════════════════════════════════════════════════════════
# PASS 3 — Narration (per day, batched)
# ════════════════════════════════════════════════════════════════════════════

_NARRATE_SYSTEM = """You are Ibn Battuta — the real 14th-century explorer, but talking to a friend like a knowledgeable local, \
not a history professor. Warm, direct, occasionally funny. Present tense. Plain English.
Output only valid JSON."""

_NARRATE_TEMPLATE = """Day {day_number} of the trip, in {city}. Theme: {theme}.
{city_ctx}
Stops today:
{stops_block}

Write the narration. Output JSON:
{{
  "summary": "<one lively sentence, 12-20 words, that makes someone want to be there>",
  "stops": [
    {{ "order_index": 0, "narration": "<60-100 word paragraph for stop 0>" }},
    {{ "order_index": 1, "narration": "..." }},
    ...
  ]
}}

Rules:
- Talk TO the person, use 'you' — like a friend walking alongside.
- 60-100 words per stop. Concrete details: what you see, hear, smell right now.
- A light joke or dry observation is welcome once or twice across the day — not every stop.
- No brochure language ("stunning", "breathtaking", "must-see"). Show, don't sell.
- Never say "tourist". They are travelers.
- Weave in the Knowledge notes naturally; don't copy them word for word.
- The day theme is {theme} — let it color the mood without forcing it."""


def _rag_snippet(place: Place, city: str, theme: str = "") -> str:
    """Query ChromaDB for relevant chunks about this place, anchored to city and theme."""
    try:
        q = f"{place.name} {city} {theme} history culture atmosphere"
        return query_knowledge(q, city=city, n_results=3)
    except Exception:
        return ""


def pass_narrate(
    *,
    day_number: int,
    city: str,
    theme: str,
    stops_with_places: list[tuple[dict, Place]],
) -> dict:
    """Returns: {"summary": str, "stops": [{"order_index": int, "narration": str}, ...]}"""
    if not stops_with_places:
        return {"summary": "A free day.", "stops": []}

    # City-level RAG: atmosphere + thematic context for the day
    city_ctx = ""
    try:
        raw = query_knowledge(
            f"{theme} {city} atmosphere walking experience feel",
            city=city, n_results=2,
        )
        if raw:
            city_ctx = f"\nCity atmosphere notes (weave in naturally, don't copy):\n{raw[:400]}\n"
    except Exception:
        pass

    stop_lines = []
    for i, (stop, place) in enumerate(stops_with_places):
        desc = place.short_desc or place.type
        line = (
            f"  [{i}] {place.name}"
            + (f" / {place.name_ar}" if place.name_ar else "")
            + f" — {desc}; "
            + f"{stop['start_time']} for {stop['duration_minutes']} min"
            + (f"; {_PRICE_LABELS.get(place.price_tier, '')} entry" if place.price_tier is not None else "")
            + (f"; best in {place.best_time_of_day}" if place.best_time_of_day else "")
            + "."
        )
        ctx = _rag_snippet(place, city, theme)
        if ctx:
            line += f"\n      Knowledge notes: {ctx[:700]}"
        stop_lines.append(line)

    user_msg = _NARRATE_TEMPLATE.format(
        day_number  = day_number,
        city        = city,
        theme       = theme,
        city_ctx    = city_ctx,
        stops_block = "\n".join(stop_lines),
    )
    out = call_local_llm_json(
        user_msg, system_prompt=_NARRATE_SYSTEM, max_output_tokens=1800, temperature=0.7
    )

    if not isinstance(out, dict) or "stops" not in out:
        raise ValueError(f"Narration malformed: {out!r}")
    return out


# ════════════════════════════════════════════════════════════════════════════
# Orchestrator with progress callback
# ════════════════════════════════════════════════════════════════════════════

ProgressFn = Callable[[str, dict], None]


def generate_itinerary(
    db: Session,
    *,
    start_city: str,
    num_days: int,
    interests: list[str],
    party_size: int = 2,
    pace: str = "balanced",
    budget: str = "mid",
    notes: str = "",
    available_cities: Optional[list[str]] = None,
    progress: Optional[ProgressFn] = None,
) -> dict:
    """
    Orchestrate the 3 passes.
    Returns the assembled itinerary dict (NOT yet persisted to DB).
    """
    notify = progress or (lambda _e, _p: None)

    # Only offer cities that actually have places in the DB
    db_cities = _distinct_cities(db)
    cities = [c for c in (available_cities or db_cities) if c in db_cities] or db_cities

    # Normalise start_city to exact DB spelling
    start_city = _normalize_city(start_city, db_cities, db_cities[0] if db_cities else start_city)

    # ── Pass 1 ──────────────────────────────────────────────────────────────
    notify("phase", {"phase": "plan", "label": "Charting the journey"})
    plan = pass_plan(
        start_city       = start_city,
        num_days         = num_days,
        party_size       = party_size,
        pace             = pace,
        budget           = budget,
        interests        = interests,
        notes            = notes,
        available_cities = cities,
    )
    notify("plan_ready", {"title": plan["title"], "days": plan["days"]})

    # ── Pass 2 + 3 — per-day ────────────────────────────────────────────────
    full_days: list[dict] = []
    for entry in plan["days"]:
        day_no = entry["day"]
        city   = entry["city"]   # already normalized in pass_plan
        theme  = entry.get("theme", "")

        notify("phase", {"phase": "select", "label": f"Choosing stops for day {day_no}", "day": day_no})

        candidates = fetch_candidates(db, city, interests, budget=budget)
        if not candidates:
            logger.warning("No candidates for city=%r day=%d — falling back to %r", city, day_no, start_city)
            city       = start_city
            candidates = fetch_candidates(db, start_city, interests, budget=budget)

        stops_meta = pass_select(
            day_number = day_no,
            city       = city,
            theme      = theme,
            pace       = pace,
            budget     = budget,
            interests  = interests,
            candidates = candidates,
        )

        place_by_id = {p.id: p for p in candidates}
        stops_with_places = [
            (s, place_by_id[s["place_id"]])
            for s in stops_meta
            if s["place_id"] in place_by_id
        ]
        notify("day_stops_ready", {
            "day": day_no, "city": city, "theme": theme,
            "stops": [_stop_payload(s, p) for s, p in stops_with_places],
        })

        notify("phase", {"phase": "narrate", "label": f"Narrating day {day_no}", "day": day_no})
        narration = pass_narrate(
            day_number        = day_no,
            city              = city,
            theme             = theme,
            stops_with_places = stops_with_places,
        )

        narr_by_idx = {n["order_index"]: n.get("narration", "") for n in narration.get("stops", [])}
        full_stops = []
        for i, (s, p) in enumerate(stops_with_places):
            full_stops.append({
                **_stop_payload(s, p),
                "narration": narr_by_idx.get(i, ""),
            })

        full_days.append({
            "day_number": day_no,
            "city":       city,
            "theme":      theme,
            "summary":    narration.get("summary", ""),
            "stops":      full_stops,
        })
        notify("day_narration_ready", {
            "day": day_no,
            "summary": narration.get("summary", ""),
            "stops": full_stops,
        })

    return {
        "title":      plan["title"],
        "start_city": start_city,
        "num_days":   num_days,
        "days":       full_days,
    }


def _stop_payload(stop: dict, place: Place) -> dict:
    return {
        "order_index":      stop["order_index"],
        "place_id":         place.id,
        "name":             place.name,
        "lat":              place.lat,
        "lon":              place.lon,
        "emoji":            place.emoji,
        "city":             place.city,
        "start_time":       stop["start_time"],
        "duration_minutes": stop["duration_minutes"],
    }
