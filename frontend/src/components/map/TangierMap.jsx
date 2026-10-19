import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Ornament from '../ui/Ornament';

// ─── Starting point: Grand Socco, Tangier ──────────────────────────────────
const START = [35.7794, -5.8082];

// ─── Emoji / glyph icon ─────────────────────────────────────────────────────
// opts: { color, muted, active }
// muted  = visited stop (greyscale + low opacity)
// active = currently-narrating stop (ochre background ring)
const makeIcon = (emoji, size = 22, opts = {}) => {
    const { color = null, muted = false, active = false } = (typeof opts === 'string')
        ? { color: opts }           // backwards-compat: makeIcon(e, n, '#hex')
        : opts;

    const colorStyle  = color ? `color:${color};` : '';
    const filterStyle = muted
        ? 'filter:grayscale(1) opacity(0.35);'
        : 'filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));';
    const bgStyle = active
        ? 'background:oklch(0.520 0.105 55 / 0.22);border-radius:50%;outline:2px solid oklch(0.520 0.105 55);outline-offset:2px;'
        : '';

    const pad = active ? size * 0.45 : 0;
    const box = size + pad * 2;

    return L.divIcon({
        html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:${box}px;height:${box}px;${bgStyle}">
                   <span style="font-size:${size}px;line-height:1;display:block;${colorStyle}${filterStyle}">${emoji}</span>
               </span>`,
        className: '',
        iconAnchor:  [box / 2, box / 2],
        popupAnchor: [0, -(box / 2 + 4)],
    });
};

// ─── GPS "you are here" dot ─────────────────────────────────────────────────
const GPS_ICON = L.divIcon({
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;
                background:#3B82F6;border:2px solid white;
                box-shadow:0 0 0 6px rgba(59,130,246,0.22),0 2px 6px rgba(0,0,0,0.35)">
           </span>`,
    className: '',
    iconAnchor:  [7, 7],
    popupAnchor: [0, -12],
});

// ─── Haversine distance in km ───────────────────────────────────────────────
export function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Fetch driving route from OSRM demo server ─────────────────────────────
// OSRM expects lon,lat order; Leaflet needs lat,lon — we swap on output.
async function fetchRoute(from, to) {
    const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from[1]},${from[0]};${to[1]},${to[0]}` +
        `?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const data = await res.json();
    if (!data.routes?.length) return [];
    return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

// ─── Find landmarks that lie within `thresholdKm` of any route point ───────
function findNearbyOnRoute(polyline, destination, all, thresholdKm = 5) {
    return all.filter(lm => {
        if (lm.name === destination.name) return false;
        return polyline.some(pt => haversine(lm.lat, lm.lon, pt[0], pt[1]) <= thresholdKm);
    });
}

// ─── Landmark data ──────────────────────────────────────────────────────────
export const LANDMARKS = [
    // ── Medina & Culture ──
    {
        lat: 35.7847, lon: -5.8060, emoji: '☕',
        name: 'Petit Socco',       sub: 'Place Souk Dakhel',
        desc: 'Atmospheric little square deep in the Medina — once the literary haunt of Paul Bowles and William Burroughs.',
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7888, lon: -5.8118, emoji: '🏰',
        name: 'Kasbah Museum',     sub: 'Dar el-Makhzen',
        desc: "Former sultan's palace turned museum of Moroccan arts. Panoramic views over the Strait of Gibraltar.",
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7883, lon: -5.8125, emoji: '🏛️',
        name: 'Musée Archéologique', sub: 'Kasbah quarter',
        desc: 'Tangier\'s archaeological museum inside the Kasbah walls — Roman mosaics, Phoenician artefacts, and Punic inscriptions.',
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7840, lon: -5.8055, emoji: '🎖️',
        name: 'American Legation', sub: 'TALIM Museum',
        desc: "The only US National Historic Landmark outside the United States — Morocco's gift to America in 1821.",
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7795, lon: -5.8083, emoji: '🎬',
        name: 'Cinéma Rif',        sub: 'Grand Socco',
        desc: 'Iconic 1938 art-déco cinema on Grand Socco — home of the Tangier International Film Festival.',
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7797, lon: -5.8101, emoji: '🌳',
        name: 'Mendoubia Gardens', sub: 'Jardin du Mendoubia',
        desc: 'Lush gardens sheltering an 800-year-old dragon tree and monuments to Moroccan independence.',
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7779, lon: -5.8086, emoji: '🏨',
        name: 'Hôtel El Minzah',   sub: 'Historic 1930 landmark',
        desc: "Legendary hotel that hosted Churchill, Matisse and Onassis — the symbol of Tangier's cosmopolitan golden age.",
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7816, lon: -5.8127, emoji: '🎨',
        name: 'Galerie Delacroix',  sub: 'French Institute gallery',
        desc: 'Exhibition space of the French Institute, named after Eugène Delacroix who captured Tangier in vivid paintings during his 1832 visit.',
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7820, lon: -5.8107, emoji: '🎭',
        name: 'Gran Teatro Cervantes', sub: 'Derelict 1913 Art Deco theatre',
        desc: "Tangier's once-grand Spanish theatre from 1913 — now a hauntingly beautiful ruin, the largest abandoned theatre in Africa.",
        cat:  'Medina & Culture',
    },
    {
        lat: 35.7904, lon: -5.8339, emoji: '🍵',
        name: 'Café Hafa',          sub: 'Cliff-top terrace since 1921',
        desc: 'Legendary terraced café carved into the cliff above the Strait — the Rolling Stones and the Beatles came here for mint tea and the view.',
        cat:  'Medina & Culture',
    },

    // ── Coast & Port ──
    {
        lat: 35.8060, lon: -5.8125, emoji: '⚓',
        name: 'Tangier Port',      sub: 'Ferry terminal',
        desc: 'Gateway between Africa and Europe — ferries depart across the 14 km Strait of Gibraltar to Spain.',
        cat:  'Coast & Port',
    },
    {
        lat: 35.7789, lon: -5.7922, emoji: '🌅',
        name: 'Municipal Beach',    sub: 'Corniche promenade',
        desc: "The main town beach stretching along Tangier's bay — a lively promenade of cafés, pedal boats and evening strollers.",
        cat:  'Coast & Port',
    },
    {
        lat: 35.7762, lon: -5.7889, emoji: '🏖️',
        name: 'Tangier Beach',     sub: 'Plage de Tangier',
        desc: "Wide sandy beach stretching east along the bay — Tangier's favourite promenade and seafront.",
        cat:  'Coast & Port',
    },
    {
        lat: 35.7785, lon: -5.7773, emoji: '🐚',
        name: 'Malabata Beach',     sub: 'Quieter bay east of centre',
        desc: 'A calmer stretch of sand east of the city hustle — backed by pine trees with clear views across to the Spanish coast.',
        cat:  'Coast & Port',
    },
    {
        lat: 35.8126, lon: -5.7552, emoji: '🔦',
        name: 'Cap Malabata',      sub: 'Lighthouse & beach',
        desc: 'Scenic lighthouse headland east of the city with sweeping views of Gibraltar and the Spanish coast.',
        cat:  'Coast & Port',
    },
    {
        lat: 35.7944, lon: -5.8352, emoji: '🌊',
        name: 'Plage Merkala',      sub: 'Wild beach below Marshan cliffs',
        desc: 'A rugged, largely undiscovered beach directly below the Marshan plateau — dramatic cliff backdrop, strong Atlantic swells.',
        cat:  'Coast & Port',
    },

    // ── Nature & Viewpoints ──
    {
        lat: 35.7809, lon: -5.8118, emoji: '🪑',
        name: 'Terrasse des Paresseux', sub: '"Lazy terrace" panorama',
        desc: "Tangier's most celebrated viewpoint terrace overlooking the port and Strait — nicknamed the 'terrace of the idle' by its habitual loungers.",
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7890, lon: -5.8120, emoji: '🚪',
        name: 'Bab Al Bahr',        sub: 'Sea Gate, Kasbah',
        desc: 'The historic Sea Gate of the Kasbah — once the fortified entrance facing the Strait, now a dramatic archway framing the port below.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7903, lon: -5.8255, emoji: '🏛️',
        name: 'Palais Marshan',     sub: 'Royal summer plateau',
        desc: "The broad Marshan plateau where the sultan's summer palace once stood — a quiet residential hilltop with century-old gardens and sea air.",
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7873, lon: -5.8233, emoji: '🔭',
        name: 'Mirador Marshan',    sub: 'Strait of Gibraltar panorama',
        desc: 'Elevated lookout point on the Marshan hill with an unobstructed panorama over the Strait of Gibraltar and the Spanish coast beyond.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7910, lon: -5.8201, emoji: '⚰️',
        name: 'Phoenician Necropolis', sub: '3,000-year-old burial site',
        desc: 'Ancient Phoenician burial ground on the Marshan — one of the oldest archaeological sites in Morocco, dating back to 800 BCE.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7658, lon: -5.7894, emoji: '🌄',
        name: 'Charf Hill',         sub: 'Bay panorama viewpoint',
        desc: "The highest natural vantage point within Tangier city — a sweeping 180° view over the entire bay, port and medina roofscape.",
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7921, lon: -5.9234, emoji: '🌊',
        name: 'Cap Spartel',       sub: 'Atlantic meets Mediterranean',
        desc: 'The north-westernmost tip of Africa — the precise point where two great seas merge.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7877, lon: -5.9272, emoji: '🪧',
        name: 'Two Seas Signpost',  sub: 'Atlantic & Mediterranean marker',
        desc: 'The famous roadside signpost near Cap Spartel marking the exact boundary where the Atlantic Ocean meets the Mediterranean Sea.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7803, lon: -5.9285, emoji: '🗿',
        name: "Grottes d'Hercule", sub: 'Caves of Hercules',
        desc: 'Mythological sea-cave whose Atlantic opening mirrors the outline of Africa. Legend says Hercules rested here.',
        cat:  'Nature & Viewpoints',
    },
    {
        lat: 35.7682, lon: -5.9052, emoji: '🏝️',
        name: 'Achakkar Beach',    sub: 'Wild Atlantic coast',
        desc: 'Open Atlantic beach just south of Cap Spartel — dunes, crashing waves, almost no crowds.',
        cat:  'Nature & Viewpoints',
    },

    // ── Day Trips ──
    {
        lat: 35.4664, lon: -6.0352, emoji: '🎨',
        name: 'Asilah',            sub: '45 km south',
        desc: 'Fortified coastal town known for its whitewashed medina, annual open-air mural festival and superb seafood.',
        cat:  'Day Trips',
    },
    {
        lat: 35.5706, lon: -5.3683, emoji: '🕌',
        name: 'Tetouan',           sub: '60 km east — UNESCO Medina',
        desc: 'UNESCO World Heritage medina with Andalusian architecture — considered the most authentic in northern Morocco.',
        cat:  'Day Trips',
    },
    {
        lat: 35.1714, lon: -5.2681, emoji: '💙',
        name: 'Chefchaouen',       sub: '110 km SE — The Blue City',
        desc: "Morocco's most photographed city — every alley painted in shades of blue, nestled high in the Rif Mountains.",
        cat:  'Day Trips',
    },
    {
        lat: 35.8499, lon: -5.3521, emoji: '🛂',
        name: 'Fnideq / Ceuta',    sub: '35 km east — border crossing',
        desc: 'Gateway to the Spanish enclave of Ceuta (Sebta) — an interesting border town with duty-free commerce.',
        cat:  'Day Trips',
    },
];

const CATEGORIES = [
    { label: 'Medina & Culture',    emoji: '🏛️' },
    { label: 'Coast & Port',        emoji: '🏖️' },
    { label: 'Nature & Viewpoints', emoji: '🌊' },
    { label: 'Day Trips',           emoji: '🗺️' },
];

// ─── Map controller: fits the view to the full route after fetch ────────────
function RouteController({ route, selected }) {
    const map = useMap();
    useEffect(() => {
        if (route.length > 1) {
            map.fitBounds(L.latLngBounds(route), { padding: [30, 30], maxZoom: 14, animate: true });
        } else if (selected) {
            map.flyTo([selected.lat, selected.lon], 14, { duration: 1.5 });
        }
    }, [route, selected, map]);
    return null;
}

// ─── Fixes tile loading when map lives inside a flex container ──────────────
function MapResizer() {
    const map = useMap();
    useEffect(() => { setTimeout(() => map.invalidateSize(), 120); }, [map]);
    return null;
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function TangierMap({
    onLandmarkSelect,
    userPos        = null,  // [lat, lon] — live GPS dot (null = hide)
    visitedStopIds = null,  // Set<string> — greyed-out stops
    activeStopId   = null,  // string — currently narrating stop (ochre ring)
    customRoute    = null,  // { name, lat, lon, emoji? } — chat-driven destination
}) {
    const [selected, setSelected] = useState(null);
    const [route,    setRoute]    = useState([]);
    const [fetching, setFetching] = useState(false);
    const [progress, setProgress] = useState(1);   // 0 → 1 polyline draw-in

    // When ChatContainer resolves a non-landmark destination, auto-route to it
    useEffect(() => {
        if (!customRoute) return;
        const dest = {
            name:  customRoute.name,
            lat:   customRoute.lat,
            lon:   customRoute.lon,
            emoji: customRoute.emoji || '📍',
            sub:   'Via conversation',
            cat:   null,
        };
        setSelected(dest);
        setFetching(true);
        fetchRoute(START, [dest.lat, dest.lon])
            .then(pts  => { setRoute(pts);  setFetching(false); })
            .catch(()  => { setRoute([]);   setFetching(false); });
    }, [customRoute]);

    // Animate the route's draw-in by progressively revealing slice(0, n)
    useEffect(() => {
        if (route.length < 2) { setProgress(1); return; }
        setProgress(0);
        const start = performance.now();
        const dur   = 700;
        let raf;
        const tick = (t) => {
            const p = Math.min(1, (t - start) / dur);
            // ease-out cubic
            setProgress(1 - Math.pow(1 - p, 3));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [route]);

    const handleSelect = async (lm) => {
        if (fetching) return;

        // Toggle off on re-click
        if (selected?.name === lm.name) {
            setSelected(null);
            setRoute([]);
            return;
        }

        setSelected(lm);
        setFetching(true);

        let routePts = [];
        try {
            routePts = await fetchRoute(START, [lm.lat, lm.lon]);
            setRoute(routePts);
        } catch {
            setRoute([]);
        } finally {
            setFetching(false);
        }

        const nearby = routePts.length
            ? findNearbyOnRoute(routePts, lm, LANDMARKS)
            : [];

        onLandmarkSelect?.(lm, nearby);
    };

    // Slice route for draw-in effect
    const visibleRoute = route.length > 1
        ? route.slice(0, Math.max(2, Math.ceil(route.length * progress)))
        : [];

    // Compute route distance (km) & approx walking time (min, ~5 km/h)
    let routeKm = 0;
    if (route.length > 1) {
        for (let i = 1; i < route.length; i++) {
            routeKm += haversine(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]);
        }
    }
    const routeMin = Math.round(routeKm * 12);   // ~5 km/h

    return (
        <div className="relative flex w-full h-full overflow-hidden border border-line-soft bg-bone-deep">

            {/* ── Sidebar legend (clickable) ────────────────────────── */}
            <div
                className="w-56 flex-shrink-0 h-full overflow-y-auto bg-bone border-r border-line-soft flex flex-col select-none"
                style={{ zIndex: 1002 }}
            >
                {/* Header */}
                <div className="px-5 pt-5 pb-3 flex-shrink-0">
                    <div className="t-caption">— Plate V</div>
                    <p
                        className="text-ink leading-none mt-2"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   '24px',
                            letterSpacing: '-0.012em',
                        }}
                    >
                        Landmarks
                    </p>
                    <p className="t-small italic mt-1" style={{ color: 'var(--color-ink-soft)' }}>
                        Tangier &amp; the Strait
                    </p>
                </div>

                <div className="hairline-soft mx-5" />


                {CATEGORIES.map((cat, ci) => (
                    <div key={cat.label} className="flex-shrink-0">

                        {/* Category heading — mono caption */}
                        <div className="px-5 pt-4 pb-1.5">
                            <p className="t-caption">— {cat.label}</p>
                        </div>

                        {/* Landmark buttons */}
                        {LANDMARKS.filter(lm => lm.cat === cat.label).map((lm) => {
                            const active = selected?.name === lm.name;
                            return (
                                <button
                                    key={lm.name}
                                    onClick={() => handleSelect(lm)}
                                    disabled={fetching}
                                    className={`w-full text-left px-5 py-1.5 transition-colors duration-300 disabled:opacity-50 disabled:cursor-wait flex items-baseline gap-2 ${
                                        active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                                    }`}
                                >
                                    <span
                                        className="flex-shrink-0 text-[8px] leading-none"
                                        style={{ color: active ? 'var(--color-ochre)' : 'transparent' }}
                                    >
                                        ●
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span
                                            className="block truncate"
                                            style={{
                                                fontFamily: 'var(--font-body)',
                                                fontStyle:  active ? 'italic' : 'normal',
                                                fontSize:   '14px',
                                                lineHeight: 1.35,
                                            }}
                                        >
                                            {lm.name}
                                        </span>
                                        {lm.sub && (
                                            <span className="t-caption block mt-0.5 truncate"
                                                  style={{ fontSize: '9px', letterSpacing: '0.14em' }}>
                                                {lm.sub}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Inter-category hairline */}
                        {ci < CATEGORIES.length - 1 && (
                            <div className="hairline-soft mx-5 mt-3" />
                        )}
                    </div>
                ))}
            </div>

            {/* ── Map panel ────────────────────────────────────────────── */}
            <div className="flex-1 h-full relative">

                {/* Top-left plate caption (always present) */}
                <div className="absolute top-3 left-3 z-[1001] t-caption pointer-events-none">
                    — Tangier · medina · plate VI
                </div>

                {/* Route fetch indicator — bottom-center, ochre dot */}
                <AnimatePresence>
                    {fetching && (
                        <motion.div
                            key="fetching"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1001] t-caption flex items-center gap-2 pointer-events-none"
                            style={{ color: 'var(--color-ochre)' }}
                        >
                            <motion.span
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                            >●</motion.span>
                            <span>Plotting the route</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Selected — top-right, italic Cormorant + caption */}
                <AnimatePresence>
                    {selected && !fetching && (
                        <motion.div
                            key={`info-${selected.name}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
                            className="absolute top-3 right-3 z-[1001] text-right pointer-events-none"
                        >
                            <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                — En route
                            </div>
                            <div
                                className="text-ink mt-0.5"
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontStyle:  'italic',
                                    fontWeight: 300,
                                    fontSize:   '20px',
                                    letterSpacing: '-0.01em',
                                }}
                            >
                                {selected.name}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom-left metadata — distance · time (slide 10) */}
                <AnimatePresence>
                    {route.length > 1 && !fetching && (
                        <motion.div
                            key="meta"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.7 }}
                            className="absolute bottom-3 left-3 z-[1001] t-caption tabular pointer-events-none"
                            style={{ letterSpacing: '0.04em' }}
                        >
                            <span>{routeKm.toFixed(1)} km</span>
                            <span className="mx-2 opacity-50">·</span>
                            <span>{routeMin} min</span>
                            <span className="mx-2 opacity-50">·</span>
                            <span style={{ color: 'var(--color-ochre)' }}>
                                from Grand Socco
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <MapContainer
                    center={START}
                    zoom={12}
                    className="w-full h-full"
                    scrollWheelZoom
                    zoomControl={false}
                >
                    <MapResizer />
                    <RouteController route={route} selected={selected} />

                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                        maxZoom={19}
                    />

                    {/* Route — ink hairline shadow + ochre line, drawn in (slide 10 vocabulary) */}
                    {visibleRoute.length > 1 && (
                        <>
                            <Polyline positions={visibleRoute} color="#1A1410" weight={3} opacity={0.18} />
                            <Polyline
                                positions={visibleRoute}
                                color="oklch(0.520 0.105 55)"
                                weight={1.6}
                                opacity={0.95}
                                lineCap="round"
                            />
                        </>
                    )}

                    {/* Start marker — Grand Socco, ochre dot */}
                    <Marker position={START} icon={makeIcon('●', 14, 'oklch(0.520 0.105 55)')}>
                        <Popup>
                            <p style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle:  'italic',
                                fontWeight: 300,
                                fontSize:   17,
                                margin:     '0 0 2px',
                                color:      '#27221E',
                            }}>
                                Grand Socco
                            </p>
                            <p style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize:   10,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color:      'oklch(0.520 0.014 60)',
                                margin:     0,
                            }}>
                                — Departure
                            </p>
                        </Popup>
                    </Marker>

                    {/* GPS "you are here" dot */}
                    {userPos && (
                        <Marker position={userPos} icon={GPS_ICON} zIndexOffset={1000}>
                            <Popup>
                                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic',
                                            fontWeight: 300, fontSize: 15, margin: 0, color: '#27221E' }}>
                                    You are here
                                </p>
                            </Popup>
                        </Marker>
                    )}

                    {/* Landmark markers */}
                    {LANDMARKS.map((lm) => {
                        const isSelected  = selected?.name === lm.name;
                        const isActive    = activeStopId === lm.name;
                        const isVisited   = visitedStopIds?.has(lm.name) ?? false;
                        const size        = (isSelected || isActive) ? 30 : 22;
                        return (
                            <Marker
                                key={lm.name}
                                position={[lm.lat, lm.lon]}
                                icon={makeIcon(lm.emoji, size, { muted: isVisited, active: isActive })}
                                eventHandlers={{ click: () => handleSelect(lm) }}
                            >
                                <Popup maxWidth={260}>
                                    <p style={{
                                        fontFamily: 'var(--font-display)',
                                        fontStyle:  'italic',
                                        fontWeight: 300,
                                        fontSize:   18,
                                        margin:     '0 0 4px',
                                        color:      '#27221E',
                                        letterSpacing: '-0.012em',
                                    }}>
                                        {lm.name}
                                    </p>
                                    {lm.sub && (
                                        <p style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize:   9,
                                            letterSpacing: '0.18em',
                                            textTransform: 'uppercase',
                                            color: 'oklch(0.520 0.105 55)',
                                            margin: '0 0 8px',
                                        }}>
                                            — {lm.sub}
                                        </p>
                                    )}
                                    <p style={{
                                        fontFamily: 'var(--font-body)',
                                        fontSize:   13,
                                        color:      '#27221E',
                                        margin:     '0 0 12px',
                                        lineHeight: 1.5,
                                    }}>
                                        {lm.desc}
                                    </p>
                                    <button
                                        onClick={() => handleSelect(lm)}
                                        style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize:   10,
                                            color:      'oklch(0.520 0.105 55)',
                                            cursor:     'pointer',
                                            background: 'transparent',
                                            border:     0,
                                            padding:    0,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.18em',
                                        }}
                                    >
                                        ↵ Walk there with him
                                    </button>
                                </Popup>
                            </Marker>
                        );
                    })}

                    {/* Custom destination — chat-resolved non-landmark place */}
                    {selected && !LANDMARKS.some(lm => lm.name === selected.name) && (
                        <Marker
                            position={[selected.lat, selected.lon]}
                            icon={makeIcon(selected.emoji || '📍', 28, { active: true })}
                            zIndexOffset={500}
                        >
                            <Popup maxWidth={220}>
                                <p style={{
                                    fontFamily: 'var(--font-display)',
                                    fontStyle:  'italic',
                                    fontWeight: 300,
                                    fontSize:   17,
                                    margin:     '0 0 4px',
                                    color:      '#27221E',
                                    letterSpacing: '-0.012em',
                                }}>
                                    {selected.name}
                                </p>
                                <p style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize:   9,
                                    letterSpacing: '0.18em',
                                    textTransform: 'uppercase',
                                    color: 'oklch(0.520 0.105 55)',
                                    margin: 0,
                                }}>
                                    — {selected.sub}
                                </p>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
