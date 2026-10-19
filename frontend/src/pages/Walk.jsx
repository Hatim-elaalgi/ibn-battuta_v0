import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ChatContainer   from '../components/chat/ChatContainer';
import AvatarViewer    from '../components/avatar/AvatarViewer';
import TangierMap, { haversine, LANDMARKS } from '../components/map/TangierMap';
import LivePanel       from '../components/live/LivePanel';
import useGeoNavigation from '../hooks/useGeoNavigation';

const PANEL_KEYS = ['portrait', 'map', 'live'];
const STORAGE_KEY = 'walk-panels-v1';

const DEFAULT_PANELS = { portrait: true, map: true, live: false };

function loadPanels() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_PANELS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_PANELS, ...parsed };
    } catch {
        return DEFAULT_PANELS;
    }
}

// ─── Navigation bar — overlaid at bottom of map when a route is active ──────
const GEO_LABEL = {
    idle:        null,
    requesting:  '● locating…',
    active:      '● navigating',
    denied:      '○ GPS denied',
    unavailable: '○ GPS unavailable',
};

function NavBar({ stops, visitedIds, activeStopId, navEnabled, geoState, onToggle }) {
    const done  = stops.filter(s => visitedIds.has(s.id ?? s.name)).length;
    const total = stops.length;

    return (
        <div
            className="absolute bottom-0 left-0 right-0 z-[1002] flex items-center justify-between gap-3 px-4 py-2 border-t border-line-soft"
            style={{ background: 'rgba(245,240,232,0.93)', backdropFilter: 'blur(6px)' }}
        >
            {/* Progress */}
            <div className="flex items-center gap-3 min-w-0">
                <span className="t-caption tabular" style={{ letterSpacing: '0.06em' }}>
                    {done}/{total} stops
                </span>
                {navEnabled && GEO_LABEL[geoState] && (
                    <span className="t-caption" style={{ color: geoState === 'active' ? 'var(--color-ochre)' : 'var(--color-ink-soft)', textTransform: 'none', letterSpacing: '0.04em' }}>
                        {GEO_LABEL[geoState]}
                    </span>
                )}
                {navEnabled && activeStopId && (
                    <span className="t-caption italic truncate" style={{ textTransform: 'none', letterSpacing: '0.04em', fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-ochre)' }}>
                        — {activeStopId}
                    </span>
                )}
            </div>

            {/* Toggle button */}
            <button
                onClick={onToggle}
                className="flex-shrink-0 t-caption hover:text-ink transition-colors"
                style={{ color: navEnabled ? 'var(--color-ochre)' : undefined }}
            >
                {navEnabled ? '↵ Stop navigating' : '↵ Navigate with GPS'}
            </button>
        </div>
    );
}

// ─── Toolbar — toggle pills + keyboard hints ────────────────────────────────
function PanelToggles({ panels, onToggle, onShowAll, onHideAll }) {
    const items = [
        { key: 'portrait', label: 'Portrait', shortcut: '1' },
        { key: 'map',      label: 'Map',      shortcut: '2' },
        { key: 'live',     label: 'Live now', shortcut: '3' },
    ];

    return (
        <div className="flex items-center gap-1 px-3 py-2 border border-line-soft bg-bone">
            {items.map(({ key, label, shortcut }) => {
                const on = panels[key];
                return (
                    <button
                        key={key}
                        onClick={() => onToggle(key)}
                        className={`flex items-baseline gap-2 px-3 py-1.5 transition-colors duration-300 ${
                            on ? 'text-ink' : 'text-ink-mute hover:text-ink'
                        }`}
                        title={`${on ? 'Hide' : 'Show'} ${label} · ${shortcut}`}
                    >
                        <span className="text-[8px] leading-none"
                              style={{ color: on ? 'var(--color-ochre)' : 'oklch(0.78 0.012 70)' }}>
                            {on ? '●' : '○'}
                        </span>
                        <span className="text-[12px]" style={{ fontFamily: 'var(--font-body)' }}>
                            {label}
                        </span>
                        <span className="t-caption hidden md:inline" style={{ fontSize: '9px' }}>
                            {shortcut}
                        </span>
                    </button>
                );
            })}
            <div className="w-px h-5 bg-line-soft mx-1" />
            <button
                onClick={onShowAll}
                className="t-caption px-2 hover:text-ink transition-colors"
                title="Show all panels · 0"
            >
                All
            </button>
            <button
                onClick={onHideAll}
                className="t-caption px-2 hover:text-ink transition-colors"
                title="Focus mode · Esc"
            >
                Focus
            </button>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Walk() {
    const location = useLocation();
    const navigate = useNavigate();
    const [panels,      setPanels]      = useState(loadPanels);
    const [mouthEnergy, setMouthEnergy] = useState(0);
    const [isSpeaking,  setIsSpeaking]  = useState(false);
    const [autoTrigger, setAutoTrigger] = useState(null);
    const [latestLive,  setLatestLive]  = useState(null);

    // ── Navigation state ──
    const [routeStops,   setRouteStops]  = useState([]);  // stops on current route
    const [navEnabled,   setNavEnabled]  = useState(false);
    const [activeStopId, setActiveStopId] = useState(null);

    // ── Custom (chat-resolved) route destination ──
    const [customRoute, setCustomRoute] = useState(null);

    const {
        userPos, nearbyStop, visitedIds, geoState, clearVisited,
    } = useGeoNavigation({ stops: routeStops, thresholdMeters: 150, enabled: navEnabled });

    // GPS proximity → fire narration about the stop we just reached
    useEffect(() => {
        if (!nearbyStop) return;
        setActiveStopId(nearbyStop.id ?? nearbyStop.name);
        setAutoTrigger({ landmark: nearbyStop, nearby: [], proximity: true, ts: Date.now() });
    }, [nearbyStop]);

    // Persist toggle state
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(panels)); } catch {}
    }, [panels]);

    // Pick up seed prompt from /itineraries → /walk navigation
    useEffect(() => {
        const seed = location.state?.seed;
        if (seed) {
            setAutoTrigger({ prompt: seed, ts: Date.now() });
            // Clear so a back-nav doesn't fire it again
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location, navigate]);

    const togglePanel = useCallback((key) => {
        setPanels(p => ({ ...p, [key]: !p[key] }));
    }, []);

    const showAll = useCallback(() => setPanels({ portrait: true, map: true, live: true }), []);
    const hideAll = useCallback(() => setPanels({ portrait: false, map: false, live: false }), []);

    // Keyboard shortcuts (skip when typing)
    useEffect(() => {
        const handler = (e) => {
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.key === '1')         { e.preventDefault(); togglePanel('portrait'); }
            else if (e.key === '2')    { e.preventDefault(); togglePanel('map'); }
            else if (e.key === '3')    { e.preventDefault(); togglePanel('live'); }
            else if (e.key === '0')    { e.preventDefault(); showAll(); }
            else if (e.key === 'Escape'){ e.preventDefault(); hideAll(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [togglePanel, showAll, hideAll]);

    const handleAvatarState = useCallback(({ energy, speaking }) => {
        setMouthEnergy(energy);
        setIsSpeaking(speaking);
    }, []);

    const START = [35.7794, -5.8082]; // Grand Socco

    const handleLandmarkSelect = useCallback((landmark, nearby) => {
        // Build ordered stop list: sort nearby by distance from START (proxy for route order),
        // then append the destination. Only these stops will ever trigger GPS narration.
        const orderedNearby = [...nearby].sort((a, b) =>
            haversine(START[0], START[1], a.lat, a.lon) -
            haversine(START[0], START[1], b.lat, b.lon)
        );
        const stops = [...orderedNearby, landmark].map(lm => ({
            id:    lm.name,
            name:  lm.name,
            lat:   lm.lat,
            lon:   lm.lon,
            emoji: lm.emoji,
            sub:   lm.sub,
            desc:  lm.desc,
        }));
        setRouteStops(stops);
        clearVisited();
        setActiveStopId(null);

        // Immediate chat narration on click (the full guide to the destination)
        setAutoTrigger({ landmark, nearby, ts: Date.now() });
        setPanels(p => p.map ? p : { ...p, map: true });
    }, [clearVisited]); // eslint-disable-line react-hooks/exhaustive-deps

    // Called when ChatContainer detects a routing intent for any place.
    // Tries LANDMARKS first (instant); falls back to Nominatim geocoding.
    const handleRouteRequest = useCallback(async (placeName) => {
        // Ensure the map panel is visible
        setPanels(p => p.map ? p : { ...p, map: true });

        // Exact match in LANDMARKS
        const lm = LANDMARKS.find(l =>
            l.name.toLowerCase() === placeName.toLowerCase() ||
            l.name.toLowerCase().includes(placeName.toLowerCase()) ||
            placeName.toLowerCase().includes(l.name.toLowerCase())
        );
        if (lm) {
            handleLandmarkSelect(lm, []);
            return;
        }

        // Not a landmark — geocode via Nominatim (OSM)
        try {
            const q   = encodeURIComponent(`${placeName} Tangier Morocco`);
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ma`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            if (data.length > 0) {
                setCustomRoute({
                    name:  placeName,
                    lat:   parseFloat(data[0].lat),
                    lon:   parseFloat(data[0].lon),
                    emoji: '📍',
                });
            }
        } catch (err) {
            console.error('[Walk] Geocode failed:', err);
        }
    }, [handleLandmarkSelect]);

    const visibleCount = PANEL_KEYS.filter(k => panels[k]).length;
    const anyPanelOn   = visibleCount > 0;

    return (
        <div className="relative h-full w-full flex">

            {/* ── Conversation column (always visible, fluid width) ─── */}
            <motion.div
                layout
                transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
                className="relative bg-ink on-ink flex flex-col min-h-0"
                style={{ width: anyPanelOn ? '46%' : '100%' }}
            >
                <ChatContainer
                    onAvatarState={handleAvatarState}
                    autoTrigger={autoTrigger}
                    onLiveDataChange={setLatestLive}
                    onRouteRequest={handleRouteRequest}
                />
            </motion.div>

            {/* ── Right column with stacked panels ────────────────── */}
            <AnimatePresence>
                {anyPanelOn && (
                    <motion.aside
                        key="right-column"
                        layout
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
                        className="flex-1 min-w-0 flex flex-col bg-bone"
                    >
                        {/* Toolbar inside the right column */}
                        <div className="flex-shrink-0 px-7 pt-5 pb-3 flex items-center justify-between gap-4">
                            <div>
                                <div className="t-caption">— The stage</div>
                                <div className="mt-1" style={{
                                    fontFamily: 'var(--font-display)',
                                    fontStyle:  'italic',
                                    fontWeight: 300,
                                    fontSize:   '22px',
                                    letterSpacing: '-0.012em',
                                    color: 'var(--color-ink)',
                                }}>
                                    Three plates, by your asking
                                </div>
                            </div>
                            <PanelToggles
                                panels={panels}
                                onToggle={togglePanel}
                                onShowAll={showAll}
                                onHideAll={hideAll}
                            />
                        </div>

                        <div className="hairline-soft mx-7 flex-shrink-0" />

                        {/* Stacked panel grid */}
                        <div
                            className="flex-1 min-h-0 grid gap-5 px-7 pt-5 pb-7"
                            style={{
                                gridTemplateRows: visibleCount === 1
                                    ? '1fr'
                                    : visibleCount === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                            }}
                        >
                            <AnimatePresence mode="popLayout">
                                {panels.portrait && (
                                    <motion.div
                                        key="portrait"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1] }}
                                        className="min-h-0 relative"
                                    >
                                        <AvatarViewer energy={mouthEnergy} speaking={isSpeaking} />
                                    </motion.div>
                                )}
                                {panels.map && (
                                    <motion.div
                                        key="map"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1] }}
                                        className="min-h-0 relative"
                                    >
                                        <TangierMap
                                            onLandmarkSelect={handleLandmarkSelect}
                                            userPos={navEnabled ? userPos : null}
                                            visitedStopIds={navEnabled ? visitedIds : null}
                                            activeStopId={navEnabled ? activeStopId : null}
                                            customRoute={customRoute}
                                        />

                                        {/* Navigation bar — shown when a route is active */}
                                        {routeStops.length > 0 && (
                                            <NavBar
                                                stops={routeStops}
                                                visitedIds={visitedIds}
                                                activeStopId={activeStopId}
                                                navEnabled={navEnabled}
                                                geoState={geoState}
                                                onToggle={() => {
                                                    if (navEnabled) {
                                                        setNavEnabled(false);
                                                        setActiveStopId(null);
                                                    } else {
                                                        clearVisited();
                                                        setNavEnabled(true);
                                                    }
                                                }}
                                            />
                                        )}
                                    </motion.div>
                                )}
                                {panels.live && (
                                    <motion.div
                                        key="live"
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1] }}
                                        className="min-h-0 relative"
                                    >
                                        <LivePanel live={latestLive} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* ── Floating toolbar when right column is hidden (focus mode) ── */}
            <AnimatePresence>
                {!anyPanelOn && (
                    <motion.div
                        key="floating-toolbar"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.4 }}
                        className="absolute top-5 right-7 z-40"
                    >
                        <PanelToggles
                            panels={panels}
                            onToggle={togglePanel}
                            onShowAll={showAll}
                            onHideAll={hideAll}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
