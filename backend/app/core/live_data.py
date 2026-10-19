"""
Live data module — all external APIs are free and require no API key.
Fetches are parallel (ThreadPoolExecutor) so total latency ≈ slowest single call.
Results are cached 10 min per (city, lat, lon) to avoid hammering APIs.

APIs used:
  1. Open-Meteo          — current weather   (api.open-meteo.com)
  2. Open-Meteo AQ       — air quality / AQI (air-quality-api.open-meteo.com)
  3. Overpass             — restaurants + tourist attractions (overpass-api.de)
  4. Aladhan              — Islamic prayer times (api.aladhan.com)
  5. Nager.Date           — public holidays by country (date.nager.at)
  6. RestCountries        — currency, capital, language (restcountries.com)
  7. Wikipedia REST       — city summary paragraph (en.wikipedia.org)
  8. RSS (BBC / AlJazeera)— live news headlines, parsed with stdlib xml
"""

import json
import os
import re
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
TICKETMASTER_KEY = os.getenv("TICKETMASTER_API_KEY", "").strip()

# ---------------------------------------------------------------------------
# City → ISO country code mapping
# ---------------------------------------------------------------------------
CITY_COUNTRY: dict[str, str] = {
    "Tangier": "MA", "Marrakech": "MA", "Casablanca": "MA",
    "Fes": "MA", "Rabat": "MA",
    "Cairo": "EG",
    "Paris": "FR",
    "Rome": "IT",
    "Barcelona": "ES",
    "Istanbul": "TR",
    "Dubai": "AE",
    "London": "GB",
    "New York": "US",
    "Tokyo": "JP",
}

# Cities where prayer times are contextually relevant
MUSLIM_MAJORITY_COUNTRIES = {"MA", "EG", "AE", "TR", "SA", "TN", "DZ", "LY", "IQ", "SY"}

# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------
_CACHE: dict = {}
_TTL = 600  # 10 minutes


def _ck(prefix: str, city: str, lat: Optional[float], lon: Optional[float]) -> str:
    return f"{prefix}|{city}|{round(lat,2) if lat else 'x'}|{round(lon,2) if lon else 'x'}"


def _cget(k: str):
    e = _CACHE.get(k)
    return e["d"] if e and (time.time() - e["t"]) < _TTL else None


def _cset(k: str, d):
    _CACHE[k] = {"t": time.time(), "d": d}


# ---------------------------------------------------------------------------
# WMO weather code descriptions
# ---------------------------------------------------------------------------
_WMO = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Light showers", 81: "Moderate showers", 82: "Heavy showers",
    95: "Thunderstorm", 96: "Thunderstorm+hail", 99: "Thunderstorm+heavy hail",
}

_AQI_LABEL = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}

# ---------------------------------------------------------------------------
# Static restaurant fallbacks (used when Overpass unreachable)
# ---------------------------------------------------------------------------
_FALLBACK_RESTAURANTS: dict[str, list[dict]] = {
    "Tangier":    [{"name": "El Tangerino", "cuisine": "Moroccan"},
                   {"name": "Salon Bleu", "cuisine": "Mediterranean"},
                   {"name": "Saveur de Poisson", "cuisine": "Seafood"},
                   {"name": "Café Hafa", "cuisine": "Café"}],
    "Marrakech":  [{"name": "Nomad", "cuisine": "Modern Moroccan"},
                   {"name": "La Maison Arabe", "cuisine": "Traditional Moroccan"},
                   {"name": "Café des Épices", "cuisine": "Café"}],
    "Casablanca": [{"name": "La Sqala", "cuisine": "Moroccan"},
                   {"name": "Le Cabestan", "cuisine": "Seafood"}],
    "Fes":        [{"name": "Riad Fes Restaurant", "cuisine": "Moroccan"},
                   {"name": "Café Clock", "cuisine": "Fusion"}],
    "Cairo":      [{"name": "Koshary El Tahrir", "cuisine": "Egyptian"},
                   {"name": "Abou El Sid", "cuisine": "Traditional Egyptian"}],
    "Paris":      [{"name": "Café de Flore", "cuisine": "French"},
                   {"name": "Le Comptoir du Relais", "cuisine": "Bistro"}],
    "Rome":       [{"name": "Da Enzo al 29", "cuisine": "Roman"},
                   {"name": "Supplì Roma", "cuisine": "Street food"}],
    "Barcelona":  [{"name": "Bar Cañete", "cuisine": "Catalan tapas"},
                   {"name": "La Boqueria", "cuisine": "Market"}],
    "Istanbul":   [{"name": "Karaköy Lokantası", "cuisine": "Turkish"},
                   {"name": "Çiya Sofrası", "cuisine": "Anatolian"}],
    "Dubai":      [{"name": "Al Fanar", "cuisine": "Emirati"},
                   {"name": "Ravi Restaurant", "cuisine": "Pakistani"}],
}

# RSS news feeds (no key required)
_RSS_FEEDS = [
    ("BBC World",     "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Al Jazeera",    "https://www.aljazeera.com/xml/rss/all.xml"),
    ("Reuters",       "https://feeds.reuters.com/reuters/topNews"),
]


# ===========================================================================
# 1. WEATHER  —  Open-Meteo
# ===========================================================================
def fetch_weather(city: str, lat: Optional[float], lon: Optional[float]) -> dict:
    if lat is None or lon is None:
        return {"source": "none", "summary": None}
    k = _ck("weather", city, lat, lon)
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon,
                    "current_weather": "true", "wind_speed_unit": "kmh"},
            timeout=7,
        )
        r.raise_for_status()
        cw   = r.json().get("current_weather", {})
        desc = _WMO.get(cw.get("weathercode", -1), "Unknown")
        res  = {
            "source": "open-meteo",
            "temperature_c": cw.get("temperature"),
            "wind_kph":      cw.get("windspeed"),
            "description":   desc,
            "summary":       f"{desc}, {cw.get('temperature','?')}°C, wind {cw.get('windspeed','?')} km/h",
        }
        _cset(k, res)
        return res
    except Exception:
        return {"source": "none", "summary": None}


# ===========================================================================
# 2. AIR QUALITY  —  Open-Meteo AQ
# ===========================================================================
def fetch_air_quality(city: str, lat: Optional[float], lon: Optional[float]) -> dict:
    if lat is None or lon is None:
        return {}
    k = _ck("aq", city, lat, lon)
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={"latitude": lat, "longitude": lon, "current": "us_aqi,pm10,pm2_5"},
            timeout=7,
        )
        r.raise_for_status()
        cur  = r.json().get("current", {})
        aqi  = cur.get("us_aqi")
        if aqi is None:
            return {}
        # US AQI → 1-5 band
        band = 1 if aqi <= 50 else 2 if aqi <= 100 else 3 if aqi <= 150 else 4 if aqi <= 200 else 5
        res  = {
            "us_aqi":  aqi,
            "pm10":    cur.get("pm10"),
            "pm2_5":   cur.get("pm2_5"),
            "label":   _AQI_LABEL.get(band, "Unknown"),
            "summary": f"Air quality: {_AQI_LABEL.get(band,'?')} (AQI {aqi})",
        }
        _cset(k, res)
        return res
    except Exception:
        return {}


# ===========================================================================
# 3. RESTAURANTS + ATTRACTIONS  —  Overpass
# ===========================================================================
def _overpass_query(lat: float, lon: float, amenity_filter: str, radius: int, limit: int) -> list[dict]:
    query = (
        f"[out:json][timeout:12];"
        f"node{amenity_filter}(around:{radius},{lat},{lon});"
        f"out {limit};"
    )
    r = requests.post("https://overpass-api.de/api/interpreter",
                      data={"data": query}, timeout=14)
    r.raise_for_status()
    results = []
    for el in r.json().get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("name:en") or tags.get("name:fr")
        if name:
            results.append({"name": name,
                             "cuisine": tags.get("cuisine"),
                             "type":    tags.get("tourism") or tags.get("amenity")})
    return results


def fetch_restaurants(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    k = _ck("rest", city, lat, lon)
    if (c := _cget(k)):
        return c
    if lat is not None and lon is not None:
        try:
            res = _overpass_query(lat, lon, "[amenity=restaurant]", 1500, 10)
            if res:
                _cset(k, res[:8])
                return res[:8]
        except Exception:
            pass
    return _FALLBACK_RESTAURANTS.get(city, [])


def fetch_attractions(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    k = _ck("attr", city, lat, lon)
    if (c := _cget(k)):
        return c
    if lat is not None and lon is not None:
        try:
            res = _overpass_query(lat, lon,
                                  "[tourism~'attraction|museum|viewpoint|monument|gallery']",
                                  3000, 12)
            if res:
                _cset(k, res[:8])
                return res[:8]
        except Exception:
            pass
    return []


def fetch_hotels(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    k = _ck("hotel", city, lat, lon)
    if (c := _cget(k)):
        return c
    if lat is not None and lon is not None:
        try:
            res = _overpass_query(lat, lon, "[tourism=hotel]", 2000, 8)
            if res:
                _cset(k, res[:5])
                return res[:5]
        except Exception:
            pass
    return []


# ===========================================================================
# 4. PRAYER TIMES  —  Aladhan (relevant for Muslim-majority countries)
# ===========================================================================
def fetch_prayer_times(city: str, lat: Optional[float], lon: Optional[float]) -> dict:
    country = CITY_COUNTRY.get(city, "")
    if country not in MUSLIM_MAJORITY_COUNTRIES:
        return {}
    if lat is None or lon is None:
        return {}
    k = _ck("prayer", city, lat, lon)
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            "https://api.aladhan.com/v1/timings",
            params={"latitude": lat, "longitude": lon, "method": 2},
            timeout=7,
        )
        r.raise_for_status()
        timings = r.json().get("data", {}).get("timings", {})
        keep    = {k: timings[k] for k in ("Fajr","Sunrise","Dhuhr","Asr","Maghrib","Isha") if k in timings}
        _cset(k, keep)
        return keep
    except Exception:
        return {}


# ===========================================================================
# 5. PUBLIC HOLIDAYS  —  Nager.Date
# ===========================================================================
def fetch_public_holidays(city: str) -> list[dict]:
    country = CITY_COUNTRY.get(city, "")
    if not country:
        return []
    k = f"holidays|{country}|{date.today().year}"
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            f"https://date.nager.at/api/v3/PublicHolidays/{date.today().year}/{country}",
            timeout=7,
        )
        r.raise_for_status()
        holidays = [
            {"date": h["date"], "name": h["localName"] or h["name"]}
            for h in r.json()
        ]
        _cset(k, holidays)
        return holidays
    except Exception:
        return []


def _next_holiday(holidays: list[dict]) -> Optional[dict]:
    today = date.today().isoformat()
    upcoming = [h for h in holidays if h["date"] >= today]
    return upcoming[0] if upcoming else None


# ===========================================================================
# 6. COUNTRY INFO  —  RestCountries (currency, capital, language)
# ===========================================================================
def fetch_country_info(city: str) -> dict:
    country = CITY_COUNTRY.get(city, "")
    if not country:
        return {}
    k = f"country|{country}"
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            f"https://restcountries.com/v3.1/alpha/{country}",
            params={"fields": "name,currencies,languages,capital,timezones"},
            timeout=7,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            data = data[0]
        currencies = list(data.get("currencies", {}).keys())
        languages  = list(data.get("languages", {}).values())
        res = {
            "country":    data.get("name", {}).get("common", ""),
            "capital":    (data.get("capital") or [""])[0],
            "currency":   currencies[0] if currencies else "",
            "languages":  languages[:2],
            "timezone":   (data.get("timezones") or [""])[0],
        }
        _cset(k, res)
        return res
    except Exception:
        return {}


# ===========================================================================
# 7. WIKIPEDIA CITY SUMMARY
# ===========================================================================
def fetch_wikipedia_summary(city: str) -> str:
    k = f"wiki|{city}"
    if (c := _cget(k)):
        return c
    try:
        r = requests.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{city.replace(' ', '_')}",
            timeout=7,
            headers={"User-Agent": "Ibn-Battuta-Guide/1.0"},
        )
        r.raise_for_status()
        extract = r.json().get("extract", "")
        # Keep first 2 sentences only
        sentences = extract.split(". ")
        summary   = ". ".join(sentences[:2]) + ("." if len(sentences) > 1 else "")
        _cset(k, summary)
        return summary
    except Exception:
        return ""


# ===========================================================================
# 8. NEWS  —  RSS (BBC World + Al Jazeera + Reuters), filtered by city/country
# ===========================================================================
def _parse_rss(url: str, source_name: str, keyword: str, timeout: int = 8) -> list[dict]:
    """Download an RSS feed and return items whose title/description mentions keyword."""
    r = requests.get(url, timeout=timeout, headers={"User-Agent": "Ibn-Battuta-Guide/1.0"})
    r.raise_for_status()
    root  = ET.fromstring(r.content)
    items = []
    kw    = keyword.lower()
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        desc  = (item.findtext("description") or "").strip()
        link  = (item.findtext("link") or "").strip()
        if kw in title.lower() or kw in desc.lower():
            items.append({"source": source_name, "title": title, "link": link})
        if len(items) >= 5:
            break
    return items


def fetch_news(city: str, country: Optional[str] = None) -> list[dict]:
    """
    Fetch news headlines related to the city (or country) from multiple RSS feeds.
    Falls back to top world headlines if nothing city-specific is found.
    """
    k = f"news|{city}"
    if (c := _cget(k)):
        return c

    keywords_to_try = [city]
    if country:
        keywords_to_try.append(country)

    all_items: list[dict] = []

    for source_name, feed_url in _RSS_FEEDS:
        for kw in keywords_to_try:
            try:
                items = _parse_rss(feed_url, source_name, kw)
                all_items.extend(items)
            except Exception:
                pass
        if len(all_items) >= 6:
            break

    # If nothing city-specific found, grab top 4 world headlines from BBC
    if not all_items:
        try:
            r = requests.get(_RSS_FEEDS[0][1], timeout=8,
                             headers={"User-Agent": "Ibn-Battuta-Guide/1.0"})
            r.raise_for_status()
            root = ET.fromstring(r.content)
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link") or "").strip()
                if title:
                    all_items.append({"source": "BBC World", "title": title, "link": link})
                if len(all_items) >= 4:
                    break
        except Exception:
            pass

    # Deduplicate by title
    seen:  set  = set()
    unique: list = []
    for item in all_items:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique.append(item)

    result = unique[:6]
    _cset(k, result)
    return result


# ===========================================================================
# 9. EVENTS  —  Ticketmaster Discovery (primary) + Overpass venues (fallback)
# ===========================================================================

# Morocco-focused RSS feeds that carry event/culture announcements
_MOROCCO_EVENT_RSS = [
    ("Yabiladi",  "https://www.yabiladi.com/articles/rss.php"),
    ("TelQuel",   "https://telquel.ma/feed/"),
    ("Hespress",  "https://www.hespress.com/feed"),
]

# Static showcase/event fallbacks for cities with low API coverage
_FALLBACK_EVENTS: dict[str, list[dict]] = {
    "Tangier": [
        {"name": "Tanjazz Festival",          "date": "September", "venue": "Various venues, Tangier",  "category": "Music"},
        {"name": "Tangier International Film Festival", "date": "March", "venue": "Cinema Rif",        "category": "Film"},
        {"name": "Detours du Monde Festival",  "date": "July",      "venue": "Medina, Tangier",         "category": "Culture"},
        {"name": "Gnawa & World Music Festival","date": "June",     "venue": "Essaouira (nearby)",       "category": "Music"},
        {"name": "Tangier Souk Art Market",    "date": "Weekly Fri","venue": "Grand Socco",              "category": "Art"},
    ],
    "Marrakech": [
        {"name": "Marrakech International Film Festival", "date": "November", "venue": "Palais des Congrès", "category": "Film"},
        {"name": "Marrakech Popular Arts Festival",       "date": "July",     "venue": "El Badi Palace",     "category": "Culture"},
    ],
    "Casablanca": [
        {"name": "Jazzablanca Festival",       "date": "April", "venue": "Anfa Park", "category": "Music"},
    ],
    "Fes": [
        {"name": "Fes Festival of World Sacred Music", "date": "June", "venue": "Bab Al Makina", "category": "Music"},
    ],
}


def fetch_events_ticketmaster(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    """Real-time events from Ticketmaster Discovery API (requires free API key)."""
    if not TICKETMASTER_KEY:
        return []
    k = _ck("events_tm", city, lat, lon)
    if (c := _cget(k)):
        return c
    try:
        params: dict = {
            "apikey": TICKETMASTER_KEY,
            "size":   10,
            "sort":   "date,asc",
            "countryCode": CITY_COUNTRY.get(city, ""),
        }
        if lat is not None and lon is not None:
            params["latlong"] = f"{lat},{lon}"
            params["radius"]  = 60
            params["unit"]    = "km"
        else:
            params["city"] = city

        r = requests.get(
            "https://app.ticketmaster.com/discovery/v2/events.json",
            params=params, timeout=10,
        )
        r.raise_for_status()
        raw = r.json().get("_embedded", {}).get("events", [])
        events = []
        for e in raw:
            venue    = ((e.get("_embedded") or {}).get("venues") or [{}])[0]
            classify = (e.get("classifications") or [{}])[0]
            events.append({
                "name":     e.get("name", ""),
                "date":     e.get("dates", {}).get("start", {}).get("localDate", ""),
                "time":     e.get("dates", {}).get("start", {}).get("localTime", ""),
                "venue":    venue.get("name", ""),
                "category": classify.get("segment", {}).get("name", ""),
                "url":      e.get("url", ""),
                "source":   "Ticketmaster",
            })
        _cset(k, events)
        return events
    except Exception:
        return []


def fetch_events_overpass(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    """Venue-based events from OpenStreetMap (theatres, cinemas, arts centres)."""
    if lat is None or lon is None:
        return []
    k = _ck("events_op", city, lat, lon)
    if (c := _cget(k)):
        return c
    try:
        query = (
            f"[out:json][timeout:13];"
            f"("
            f'node["amenity"~"cinema|theatre|arts_centre|events_venue|nightclub"](around:4000,{lat},{lon});'
            f'node["leisure"~"stadium|sports_centre|arena"](around:4000,{lat},{lon});'
            f'node["tourism"~"attraction|theme_park"](around:4000,{lat},{lon});'
            f");"
            f"out 12;"
        )
        r = requests.post("https://overpass-api.de/api/interpreter",
                          data={"data": query}, timeout=15)
        r.raise_for_status()
        results = []
        for el in r.json().get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or tags.get("name:fr")
            if name:
                results.append({
                    "name":     name,
                    "category": tags.get("amenity") or tags.get("leisure") or tags.get("tourism") or "venue",
                    "source":   "OpenStreetMap",
                })
        _cset(k, results[:8])
        return results[:8]
    except Exception:
        return []


def fetch_events_rss(city: str) -> list[dict]:
    """Parse Morocco-focused RSS feeds for event/culture headlines."""
    k = f"events_rss|{city}"
    if (c := _cget(k)):
        return c
    items = []
    keywords = [city.lower(), "festival", "concert", "exposition", "événement", "musique", "culture"]
    for source_name, url in _MOROCCO_EVENT_RSS:
        try:
            r = requests.get(url, timeout=8, headers={"User-Agent": "Ibn-Battuta-Guide/1.0"})
            r.raise_for_status()
            root = ET.fromstring(r.content)
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link  = (item.findtext("link")  or "").strip()
                desc  = (item.findtext("description") or "").lower()
                combined = title.lower() + " " + desc
                if any(kw in combined for kw in keywords):
                    items.append({"name": title, "source": source_name, "url": link, "category": "News/Event"})
                if len(items) >= 5:
                    break
        except Exception:
            pass
    _cset(k, items[:5])
    return items[:5]


# City slug mapping for guichet.com URLs (French city names)
_GUICHET_CITY_SLUG: dict[str, str] = {
    "Tangier":    "tanger",
    "Marrakech":  "marrakech",
    "Casablanca": "casablanca",
    "Fes":        "fes",
    "Rabat":      "rabat",
}

_GUICHET_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_events_guichet(city: str) -> list[dict]:
    """
    Scrape guichet.com — Morocco's leading event ticketing site.
    Tries JSON-LD (schema.org/Event) first, then __NEXT_DATA__ hydration JSON.
    """
    slug = _GUICHET_CITY_SLUG.get(city, city.lower())
    k    = f"events_guichet|{city}"
    if (c := _cget(k)):
        return c
    try:
        url = f"https://guichet.com/ma-fr/evenements?ville={slug}"
        r   = requests.get(url, timeout=14, headers=_GUICHET_HEADERS)
        r.raise_for_status()
        html = r.text

        events: list[dict] = []

        # ── 1. JSON-LD structured data (schema.org/Event) ──
        for block in re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html, re.DOTALL
        ):
            try:
                data  = json.loads(block)
                items = data if isinstance(data, list) else data.get("@graph", [data])
                for item in items:
                    if item.get("@type", "") in (
                        "Event", "MusicEvent", "TheaterEvent",
                        "SocialEvent", "ExhibitionEvent", "Festival",
                    ):
                        loc = item.get("location", {})
                        events.append({
                            "name":     item.get("name", ""),
                            "date":     (item.get("startDate") or "")[:10],
                            "venue":    loc.get("name", "") if isinstance(loc, dict) else "",
                            "url":      item.get("url", ""),
                            "category": item.get("@type", "Event"),
                            "source":   "Guichet.com",
                        })
            except Exception:
                pass

        # ── 2. __NEXT_DATA__ hydration blob (Next.js) ──
        if not events:
            m = re.search(
                r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                html, re.DOTALL
            )
            if m:
                try:
                    page_props = json.loads(m.group(1)).get("props", {}).get("pageProps", {})
                    for key in ("events", "items", "data", "results", "concerts"):
                        raw = page_props.get(key) or (page_props.get("initialData") or {}).get(key, [])
                        if not isinstance(raw, list):
                            continue
                        for item in raw[:12]:
                            if not isinstance(item, dict):
                                continue
                            name = item.get("title") or item.get("name") or item.get("nom") or ""
                            if name:
                                events.append({
                                    "name":     name,
                                    "date":     item.get("date") or item.get("start_date") or item.get("startDate", ""),
                                    "venue":    item.get("venue") or item.get("lieu") or item.get("place", ""),
                                    "url":      item.get("url") or item.get("slug", ""),
                                    "category": item.get("category") or item.get("type", "Event"),
                                    "source":   "Guichet.com",
                                })
                        if events:
                            break
                except Exception:
                    pass

        result = [e for e in events if e["name"]][:8]
        _cset(k, result)
        return result
    except Exception:
        return []


def fetch_events(city: str, lat: Optional[float], lon: Optional[float]) -> list[dict]:
    """
    Unified events fetch (priority order):
      1. Guichet.com — Morocco's #1 ticketing site (scrape, no key)
      2. Ticketmaster Discovery API (real-time, requires free API key)
      3. Overpass venue data (OSM, no key)
      4. Morocco-focused RSS feeds (no key)
      5. Static seasonal fallback
    """
    k = _ck("events", city, lat, lon)
    if (c := _cget(k)):
        return c

    results: list[dict] = []

    # Guichet.com — best coverage for Morocco
    results.extend(fetch_events_guichet(city))

    # Ticketmaster — richest metadata when key is configured
    if len(results) < 5:
        results.extend(fetch_events_ticketmaster(city, lat, lon))

    # Overpass venues (theatres, cinemas, etc.)
    if len(results) < 5:
        results.extend(fetch_events_overpass(city, lat, lon))

    # Morocco RSS — cultural/festival headlines
    if len(results) < 5:
        results.extend(fetch_events_rss(city))

    # Static fallback
    if not results:
        results = _FALLBACK_EVENTS.get(city, [])

    _cset(k, results[:10])
    return results[:10]


# ===========================================================================
# PROMPT FORMATTER  —  compact string injected into system prompt (<450 chars)
# ===========================================================================
def format_live_data_for_prompt(
    weather:      Optional[dict],
    air_quality:  Optional[dict],
    restaurants:  Optional[list],
    attractions:  Optional[list],
    prayer_times: Optional[dict],
    news:         Optional[list],
    next_holiday: Optional[dict],
    events:       Optional[list] = None,
) -> str:
    parts: list[str] = []

    if weather and weather.get("summary"):
        w = weather["summary"]
        if air_quality and air_quality.get("label"):
            w += f", Air: {air_quality['label']}"
        parts.append(w)

    if prayer_times:
        pt = prayer_times
        parts.append(f"Prayer times — Fajr:{pt.get('Fajr','?')} Dhuhr:{pt.get('Dhuhr','?')} Maghrib:{pt.get('Maghrib','?')}")

    if next_holiday:
        parts.append(f"Upcoming holiday: {next_holiday['name']} on {next_holiday['date']}")

    if events:
        ev_names = "; ".join(e["name"] for e in events[:2] if e.get("name"))
        if ev_names:
            parts.append(f"Events: {ev_names}")

    if restaurants:
        names = ", ".join(r["name"] for r in restaurants[:3])
        parts.append(f"Restaurants: {names}")

    if attractions:
        spots = ", ".join(a["name"] for a in attractions[:3])
        parts.append(f"Attractions: {spots}")

    if news:
        headlines = "; ".join(n["title"][:60] for n in news[:2])
        parts.append(f"News: {headlines}")

    return " | ".join(parts) if parts else ""


# ===========================================================================
# MAIN ENTRY POINT  —  called by chat.py
# ===========================================================================
def get_live_data_block(
    city: str,
    latitude:  Optional[float],
    longitude: Optional[float],
) -> tuple[str, dict]:
    """
    Fetch all live data in parallel, return:
      (compact_string_for_llm_prompt, full_structured_dict_for_frontend)
    Never raises.
    """
    if not city and latitude is None:
        return "", {}

    country_code = CITY_COUNTRY.get(city, "")
    country_name = city  # fallback keyword for news

    tasks = {
        "weather":      lambda: fetch_weather(city, latitude, longitude),
        "air_quality":  lambda: fetch_air_quality(city, latitude, longitude),
        "restaurants":  lambda: fetch_restaurants(city, latitude, longitude),
        "attractions":  lambda: fetch_attractions(city, latitude, longitude),
        "hotels":       lambda: fetch_hotels(city, latitude, longitude),
        "prayer_times": lambda: fetch_prayer_times(city, latitude, longitude),
        "holidays":     lambda: fetch_public_holidays(city),
        "country_info": lambda: fetch_country_info(city),
        "wiki_summary": lambda: fetch_wikipedia_summary(city),
        "news":         lambda: fetch_news(city, country_name),
        "events":       lambda: fetch_events(city, latitude, longitude),
    }

    results: dict = {}
    try:
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {ex.submit(fn): name for name, fn in tasks.items()}
            for future in as_completed(futures, timeout=15):
                name = futures[future]
                try:
                    results[name] = future.result()
                except Exception:
                    results[name] = None
    except Exception:
        pass

    # Resolve next holiday
    holidays     = results.get("holidays") or []
    next_holiday = _next_holiday(holidays)

    # Build compact prompt string
    block = format_live_data_for_prompt(
        weather      = results.get("weather") or {},
        air_quality  = results.get("air_quality") or {},
        restaurants  = results.get("restaurants") or [],
        attractions  = results.get("attractions") or [],
        prayer_times = results.get("prayer_times") or {},
        news         = results.get("news") or [],
        next_holiday = next_holiday,
        events       = results.get("events") or [],
    )

    # Full structured payload for frontend cards
    structured = {
        "weather":      results.get("weather") or {},
        "air_quality":  results.get("air_quality") or {},
        "restaurants":  (results.get("restaurants") or [])[:5],
        "attractions":  (results.get("attractions") or [])[:5],
        "hotels":       (results.get("hotels") or [])[:4],
        "prayer_times": results.get("prayer_times") or {},
        "next_holiday": next_holiday,
        "country_info": results.get("country_info") or {},
        "wiki_summary": results.get("wiki_summary") or "",
        "news":         (results.get("news") or [])[:6],
        "events":       (results.get("events") or [])[:8],
    }

    return block, structured
