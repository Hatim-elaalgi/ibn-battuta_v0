import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NEIGHBORHOODS = [
    {
        plate: 'I',
        name: 'Medina',
        sub:  'The walled old town',
        copy: 'Tangier inside the walls — the Petit Socco at its centre, the Kasbah at its highest point. Streets are intentionally narrow; the city was designed to disorient invaders, and still does. Get lost on purpose. The exits all face the sea.',
        notes: 'Walking only. No cars after the gate.',
    },
    {
        plate: 'II',
        name: 'Kasbah',
        sub:  'The fortified citadel',
        copy: 'The medina\'s highest quarter, ringed by its own wall above the city. Once the seat of the sultan; now the painters, the writers, the slow life. Sit on the wall above Bab el-Bahr at dusk. The Strait is right there.',
        notes: 'Best at golden hour and dawn.',
    },
    {
        plate: 'III',
        name: 'Ville Nouvelle',
        sub:  'The 20th-century city',
        copy: 'Outside the walls, French- and Spanish-built, broad avenues and beaux-arts cafés. The Boulevard Pasteur runs like a spine. Where the embassies were. Where the writers — Bowles, Burroughs, Genet — drank, ate, wrote.',
        notes: 'For coffee, bookshops, and grand-café evenings.',
    },
    {
        plate: 'IV',
        name: 'Marshan',
        sub:  'The cliff district',
        copy: 'Up the hill west of the Kasbah, residential and quiet, with the Phoenician tombs cut into the cliff above the sea. The view is the longest in the city — clear days, you read Tarifa.',
        notes: 'For walking. For looking. For being still.',
    },
];

const GLOSSARY = [
    { term: 'Medina',   note: 'The walled old town of any Moroccan city. From Arabic "city".' },
    { term: 'Kasbah',   note: 'A fortified citadel, usually the highest point in a medina.' },
    { term: 'Riad',     note: 'A traditional house built around a central courtyard, often now a guesthouse.' },
    { term: 'Souk',     note: 'A market, or the market quarter of the medina.' },
    { term: 'Adhan',    note: 'The call to prayer, broadcast five times a day from the minaret.' },
    { term: 'Maghrib',  note: 'The fourth daily prayer, just after sunset. Also: the western lands — Morocco itself.' },
    { term: 'Tagine',   note: 'A slow-cooked stew, named for the conical clay vessel it cooks in.' },
    { term: 'Hammam',   note: 'A public steam bath. Older than the city, in some neighbourhoods.' },
    { term: 'Babouches',note: 'Soft leather slippers, worn indoors. Yellow for men, every colour for women.' },
    { term: 'Zellige',  note: 'Hand-cut geometric mosaic tilework. Each piece is one colour, fitted by hand.' },
    { term: 'Rihla',    note: 'A journey. Also the name of Ibn Battuta\'s travel memoir.' },
    { term: 'Sebta',    note: 'The Arabic name for the Spanish enclave of Ceuta, just east of the city.' },
];

export default function FieldGuide() {
    const [q, setQ] = useState('');

    const filteredGlossary = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return GLOSSARY;
        return GLOSSARY.filter(g =>
            g.term.toLowerCase().includes(term) || g.note.toLowerCase().includes(term)
        );
    }, [q]);

    return (
        <div className="h-full overflow-y-auto bg-bone">
            <div className="max-w-5xl mx-auto px-7 md:px-12 py-12">

                <div className="t-caption">— Plate III · Field guide</div>

                <h1 className="mt-3 leading-none"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontStyle:  'italic',
                        fontWeight: 300,
                        fontSize:   'clamp(40px, 6vw, 72px)',
                        letterSpacing: '-0.02em',
                        color: 'var(--color-ink)',
                    }}>
                    Read me<br />before you arrive.
                </h1>

                <p className="t-lede mt-7 max-w-2xl italic" style={{ fontSize: '17px' }}>
                    A short orientation. The four quarters worth knowing, and the dozen
                    words that will let you understand the menus, the directions, and the
                    call from the minaret.
                </p>

                {/* Neighborhoods */}
                <section className="mt-16">
                    <h2 className="t-caption pb-3 border-b border-line">— The quarters</h2>
                    <div className="grid md:grid-cols-2 gap-x-12 gap-y-12 mt-8">
                        {NEIGHBORHOODS.map(n => (
                            <article key={n.plate}>
                                <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                    — Plate {n.plate}
                                </div>
                                <h3 className="mt-2 leading-tight"
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        fontStyle:  'italic',
                                        fontWeight: 300,
                                        fontSize:   '32px',
                                        letterSpacing: '-0.012em',
                                    }}>
                                    {n.name}
                                </h3>
                                <p className="t-caption mt-1">{n.sub}</p>
                                <p className="mt-4"
                                   style={{
                                       fontFamily: 'var(--font-body)',
                                       fontSize:   '16px',
                                       lineHeight: 1.55,
                                       color:      'var(--color-ink)',
                                   }}>
                                    {n.copy}
                                </p>
                                <p className="t-caption italic mt-3"
                                   style={{ textTransform: 'none', letterSpacing: '0.04em', fontSize: '12px', fontFamily: 'var(--font-body)', color: 'var(--color-ink-mute)' }}>
                                    — {n.notes}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                {/* Glossary */}
                <section className="mt-20">
                    <div className="flex items-end justify-between gap-6">
                        <h2 className="t-caption pb-3 flex-1 border-b border-line">— Glossary</h2>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Filter…"
                            className="bg-transparent border-0 border-b border-line px-1 pb-2 text-[14px] italic outline-none focus:border-ochre transition-colors"
                            style={{ fontFamily: 'var(--font-body)', minWidth: 200 }}
                        />
                    </div>

                    <dl className="mt-8 grid md:grid-cols-2 gap-x-12 gap-y-5">
                        <AnimatePresence mode="popLayout">
                            {filteredGlossary.map((g, i) => (
                                <motion.div
                                    key={g.term}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4, delay: Math.min(0.04 * i, 0.3) }}
                                    className="grid grid-cols-[140px_1fr] gap-4 items-baseline border-b border-line-soft pb-4"
                                >
                                    <dt
                                        style={{
                                            fontFamily: 'var(--font-display)',
                                            fontStyle:  'italic',
                                            fontWeight: 300,
                                            fontSize:   '20px',
                                            color:      'var(--color-ink)',
                                        }}
                                    >
                                        {g.term}
                                    </dt>
                                    <dd
                                        style={{
                                            fontFamily: 'var(--font-body)',
                                            fontSize:   '14px',
                                            lineHeight: 1.5,
                                            color:      'var(--color-ink-soft)',
                                        }}
                                    >
                                        {g.note}
                                    </dd>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </dl>

                    {filteredGlossary.length === 0 && (
                        <p className="t-lede italic mt-8 text-center">— No match.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
