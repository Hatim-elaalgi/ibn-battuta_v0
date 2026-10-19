import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useMyJourneys from '../hooks/useMyJourneys';

// ─── Curated showcase data ───────────────────────────────────────────────────
const CURATED = [
    {
        id: 'medina-half-day',
        plate: 'I',
        title: 'A morning in the Medina',
        sub:   'Half-day · 4 hours · easy walk',
        moods: ['contemplative', 'historic'],
        copy:  'Begin at the Grand Socco when the cafés are still wiping their saucers. Wind up to the Kasbah; sit on the wall above the Strait. Down through the Petit Socco, mint tea at the Café Tingis, then a slow lunch at Saveur de Poisson.',
        landmarks: ['Grand Socco', 'Kasbah Museum', 'Petit Socco', 'American Legation'],
        seed: 'Take me on a half-day morning walk through the medina, beginning at the Grand Socco.',
        km: 3.4, mins: 240,
    },
    {
        id: 'cape-spartel-day',
        plate: 'II',
        title: 'To where two seas meet',
        sub:   'Full day · 8 hours · taxi & walking',
        moods: ['nature', 'wide-open'],
        copy:  'A grand cab west to Cap Spartel, the Atlantic on one side, the Mediterranean on the other. Down to the Caves of Hercules at low tide. Lunch on the cliff at Mirage. Afternoon at Achakkar Beach. Home by sunset, the city pink behind you.',
        landmarks: ['Cap Spartel', "Grottes d'Hercule", 'Achakkar Beach'],
        seed: 'Plan a full day west of Tangier — Cap Spartel, the Caves of Hercules, and the Atlantic.',
        km: 28, mins: 480,
    },
    {
        id: 'evening-prayer',
        plate: 'III',
        title: 'The light, between calls',
        sub:   'Evening · 3 hours · walking',
        moods: ['contemplative', 'spiritual'],
        copy:  "Climb to the Kasbah an hour before the Maghrib call. Sit on the wall. The light goes pink first, then ochre — and then the muezzin begins, all of them, slightly out of phase. Stay until the last call. Walk down through Rue d'Italie for sardines.",
        landmarks: ['Kasbah Museum', 'Bab el-Bahr', 'Petit Socco'],
        seed: 'Plan an evening walk that ends with the Maghrib call from the Kasbah.',
        km: 1.4, mins: 180,
    },
    {
        id: 'asilah-day-trip',
        plate: 'IV',
        title: 'Whitewashed afternoon, Asilah',
        sub:   'Day trip · 6 hours · train or taxi',
        moods: ['nature', 'art'],
        copy:  'A morning train south to Asilah — the murals change every August, the medina is quieter than ours, the Atlantic just there. Walk the ramparts at noon. Eat fish in the port. Back by sunset.',
        landmarks: ['Asilah'],
        seed: "Plan a day trip to Asilah from Tangier with its mural-painted medina.",
        km: 45, mins: 360,
    },
    {
        id: 'chefchaouen',
        plate: 'V',
        title: "The Blue City, slowly",
        sub:   'Two days · overnight · taxi',
        moods: ['mountains', 'photography'],
        copy:  'Up into the Rif before noon. Two hours of switchbacks and sheep, then Chefchaouen — every alley a different blue. Stay one night in a riad, eat tagine on a rooftop, walk the Spanish Mosque trail at dawn.',
        landmarks: ['Chefchaouen'],
        seed: 'Plan a two-day overnight trip to Chefchaouen, the Blue City, from Tangier.',
        km: 110, mins: 1440,
    },
    {
        id: 'tetouan-unesco',
        plate: 'VI',
        title: "Andalusia, preserved",
        sub:   'Day trip · 7 hours · taxi',
        moods: ['historic', 'unesco'],
        copy:  'East to Tetouan — the most authentic medina in northern Morocco, a UNESCO heritage site that feels untouched by tourism. White walls, leatherwork, the Andalusian gardens. Lunch at Restinga, home by dusk.',
        landmarks: ['Tetouan'],
        seed: 'Plan a day trip to the UNESCO medina of Tetouan east of Tangier.',
        km: 60, mins: 420,
    },
];

const ALL_MOODS = ['all', 'contemplative', 'historic', 'nature', 'art', 'mountains', 'spiritual', 'unesco'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '';
    }
}

// ─── My Journeys strip ───────────────────────────────────────────────────────
function MyJourneys({ journeys, onRemove }) {
    if (journeys.length === 0) return null;

    return (
        <section className="mt-12">
            <div className="flex items-baseline justify-between gap-6 pb-3 border-b border-line">
                <div>
                    <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>— Your journeys</div>
                    <h2 className="mt-2 leading-none"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   'clamp(28px, 4vw, 44px)',
                            letterSpacing: '-0.016em',
                        }}>
                        Journeys you have planned.
                    </h2>
                </div>
                <Link
                    to="/create"
                    className="flex-shrink-0 t-caption hover:text-ink transition-colors"
                    style={{ color: 'var(--color-ochre)' }}
                >
                    + Plan another
                </Link>
            </div>

            <ul className="mt-6 grid md:grid-cols-2 gap-x-12 gap-y-8">
                <AnimatePresence>
                    {journeys.map((j, i) => (
                        <motion.li
                            key={j.token}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.5, ease: [0.2, 0.65, 0.2, 1], delay: Math.min(0.06 * i, 0.2) }}
                            className="group flex items-start justify-between gap-4 py-4 border-b border-line-soft"
                        >
                            <div className="min-w-0">
                                <Link
                                    to={`/itinerary/${j.token}`}
                                    className="block leading-tight hover:text-ochre transition-colors"
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        fontStyle:  'italic',
                                        fontWeight: 300,
                                        fontSize:   '22px',
                                        letterSpacing: '-0.01em',
                                    }}
                                >
                                    {j.title}
                                </Link>
                                <div className="t-caption mt-1 flex items-baseline gap-2">
                                    <span>{j.city}</span>
                                    {j.created_at && (
                                        <>
                                            <span className="opacity-40">·</span>
                                            <span>{fmtDate(j.created_at)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => onRemove(j.token)}
                                className="flex-shrink-0 t-caption opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-ochre-deep transition-all"
                                title="Remove from list"
                            >
                                ✕
                            </button>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </section>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Itineraries() {
    const [mood, setMood] = useState('all');
    const { journeys, removeJourney } = useMyJourneys();

    const filtered = useMemo(
        () => mood === 'all' ? CURATED : CURATED.filter(i => i.moods.includes(mood)),
        [mood]
    );

    return (
        <div className="h-full overflow-y-auto bg-bone">
            <div className="max-w-6xl mx-auto px-7 md:px-12 py-12">

                {/* Plate caption */}
                <div className="t-caption">— Plate II · Itineraries</div>

                {/* Title row */}
                <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
                    <h1
                        className="leading-none"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   'clamp(40px, 6vw, 72px)',
                            letterSpacing: '-0.02em',
                            color: 'var(--color-ink)',
                        }}
                    >
                        Walks,<br />by mood.
                    </h1>
                    <p className="t-lede max-w-md italic" style={{ fontSize: '17px' }}>
                        Six curated routes through Tangier and its country —
                        or&nbsp;
                        <Link to="/create" className="underline underline-offset-2 hover:text-ochre transition-colors">
                            plan your own journey.
                        </Link>
                    </p>
                </div>

                {/* My Journeys */}
                <MyJourneys journeys={journeys} onRemove={removeJourney} />

                {/* Curated header */}
                <div className="mt-16 flex items-baseline justify-between gap-6 pb-3 border-b border-line">
                    <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>— Curated routes</div>
                    {/* Mood filter */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {ALL_MOODS.map(m => {
                            const on = mood === m;
                            return (
                                <button
                                    key={m}
                                    onClick={() => setMood(m)}
                                    className={`flex items-baseline gap-1.5 px-3 py-1.5 transition-colors duration-300 ${
                                        on ? 'text-ink' : 'text-ink-mute hover:text-ink'
                                    }`}
                                >
                                    <span className="text-[8px] leading-none"
                                          style={{ color: on ? 'var(--color-ochre)' : 'oklch(0.78 0.012 70)' }}>
                                        {on ? '●' : '○'}
                                    </span>
                                    <span className="text-[12px]" style={{ fontFamily: 'var(--font-body)' }}>
                                        {m === 'all' ? 'All' : m}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Cards grid */}
                <div className="mt-10 grid md:grid-cols-2 gap-x-12 gap-y-14">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((it, i) => (
                            <motion.article
                                key={it.id}
                                layout
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1], delay: Math.min(0.1 * i, 0.4) }}
                            >
                                <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                    — Plate {it.plate}
                                </div>
                                <h2
                                    className="mt-3 leading-tight"
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        fontStyle:  'italic',
                                        fontWeight: 300,
                                        fontSize:   '32px',
                                        letterSpacing: '-0.012em',
                                        color: 'var(--color-ink)',
                                    }}
                                >
                                    {it.title}
                                </h2>
                                <div className="t-caption mt-2">{it.sub}</div>

                                <p
                                    className="mt-5 max-w-prose"
                                    style={{
                                        fontFamily: 'var(--font-body)',
                                        fontSize:   '17px',
                                        lineHeight: 1.55,
                                        color:      'var(--color-ink-soft)',
                                    }}
                                >
                                    {it.copy}
                                </p>

                                <div className="hairline-soft mt-6" />

                                <div className="mt-4 flex items-baseline justify-between gap-4">
                                    <div className="t-caption tabular" style={{ letterSpacing: '0.04em' }}>
                                        <span>{it.km < 10 ? it.km.toFixed(1) : Math.round(it.km)} km</span>
                                        <span className="mx-2 opacity-50">·</span>
                                        <span>{it.mins >= 60 ? `${Math.round(it.mins/60)}h` : `${it.mins} min`}</span>
                                    </div>
                                    <Link
                                        to="/walk"
                                        state={{ seed: it.seed }}
                                        className="t-caption hover:text-ink transition-colors"
                                        style={{ color: 'var(--color-ochre)' }}
                                    >
                                        ↵ Walk this with him
                                    </Link>
                                </div>
                            </motion.article>
                        ))}
                    </AnimatePresence>
                </div>

                {filtered.length === 0 && (
                    <p className="t-lede italic mt-16 text-center">
                        — None this mood. Try another.
                    </p>
                )}

                {/* CTA if no saved journeys yet */}
                {journeys.length === 0 && (
                    <div className="mt-20 pt-10 border-t border-line text-center">
                        <span className="text-ochre"
                              style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '32px' }}>
                            ⁂
                        </span>
                        <p className="t-lede italic mt-4" style={{ fontSize: '15px' }}>
                            — Or let him plan the whole thing.
                        </p>
                        <Link
                            to="/create"
                            className="inline-flex items-baseline gap-3 mt-6 px-9 py-4 bg-ink text-bone hover:bg-ochre transition-colors duration-500"
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle:  'italic',
                                fontWeight: 300,
                                fontSize:   '18px',
                            }}
                        >
                            Plan a journey &nbsp;→
                        </Link>
                    </div>
                )}

            </div>
        </div>
    );
}
