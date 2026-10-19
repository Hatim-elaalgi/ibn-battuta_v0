import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const HERO_IMG =
    'https://images.unsplash.com/photo-1749993084340-ba0faa17217e?auto=format&fit=crop&w=1600&q=70';
//  Tangier harbour at golden hour — yachts, the Strait, ochre light. Fallback: bone gradient.

function useNow() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);
    return now;
}

export default function FrontDoor() {
    const now    = useNow();
    const [imgOk, setImgOk] = useState(true);

    return (
        <div className="relative h-full w-full overflow-hidden bg-ink on-ink">

            {/* Background image — slow Ken Burns */}
            {imgOk && (
                <motion.img
                    src={HERO_IMG}
                    alt=""
                    onError={() => setImgOk(false)}
                    initial={{ scale: 1.04, opacity: 0 }}
                    animate={{ scale: 1.0,  opacity: 0.55 }}
                    transition={{ duration: 1.6, ease: [0.2, 0.65, 0.2, 1] }}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}
            {/* Tonal wash so text reads cleanly */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{
                     background:
                         'linear-gradient(180deg, rgba(26,20,16,0.55) 0%, rgba(26,20,16,0.20) 35%, rgba(26,20,16,0.85) 100%)',
                 }} />

            {/* Plate caption — top-left */}
            <div className="absolute top-5 left-7 t-caption" style={{ color: 'oklch(0.78 0.012 70)' }}>
                — Plate I · The proposition
            </div>

            {/* Live now corner — bottom-right */}
            <div className="absolute bottom-7 right-7 t-caption flex items-baseline gap-3 tabular pointer-events-none">
                <span className="text-ochre">●</span>
                <span>{now.toTimeString().slice(0, 5)} · Tangier</span>
            </div>

            {/* Hero copy — left column */}
            <div className="relative h-full grid md:grid-cols-2 px-7 md:px-16 py-24">

                <div className="flex flex-col justify-center max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, ease: [0.2, 0.65, 0.2, 1], delay: 0.1 }}
                        className="t-eyebrow"
                        style={{ color: 'var(--color-ochre)' }}
                    >
                        — A travelling companion
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, ease: [0.2, 0.65, 0.2, 1], delay: 0.2 }}
                        className="mt-7 leading-[0.95]"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   'clamp(56px, 10vw, 132px)',
                            letterSpacing: '-0.02em',
                            color: 'var(--color-bone)',
                        }}
                    >
                        Tangier,<br />told softly.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.0, ease: [0.2, 0.65, 0.2, 1], delay: 0.4 }}
                        className="mt-9 max-w-xl"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontStyle:  'italic',
                            fontSize:   '20px',
                            lineHeight: 1.45,
                            color:      'oklch(0.85 0.012 70)',
                        }}
                    >
                        A conversation with Ibn Battuta &mdash; born here, returned here, knows
                        every doorway. Ask him anything. He&rsquo;ll show you.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.0, ease: [0.2, 0.65, 0.2, 1], delay: 0.6 }}
                        className="mt-12 flex items-center gap-7 flex-wrap"
                    >
                        <Link
                            to="/create"
                            className="group inline-flex items-baseline gap-3 px-9 py-4 bg-bone text-ink hover:bg-ochre hover:text-bone transition-colors duration-500"
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle:  'italic',
                                fontWeight: 300,
                                fontSize:   '20px',
                                letterSpacing: '0.01em',
                            }}
                        >
                            Plan a journey
                            <span className="transition-transform duration-500 group-hover:translate-x-1">
                                &nbsp;→
                            </span>
                        </Link>

                        <Link
                            to="/walk"
                            className="italic hover:text-bone transition-colors"
                            style={{
                                fontFamily: 'var(--font-body)',
                                fontSize:   '15px',
                                color:      'oklch(0.78 0.01 70)',
                            }}
                        >
                            &mdash; or simply, &ldquo;Salaam.&rdquo;
                        </Link>
                    </motion.div>
                </div>

                {/* Right column — Arabic flourish */}
                <div className="hidden md:flex flex-col items-end justify-end pb-2">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.85 }}
                        transition={{ duration: 1.4, delay: 0.4 }}
                        className="text-right"
                    >
                        <span
                            className="block leading-none"
                            style={{
                                fontFamily: 'var(--font-arabic)',
                                fontSize:   'clamp(60px, 9vw, 140px)',
                                color:      'var(--color-bone)',
                            }}
                        >
                            ابن بطوطة
                        </span>
                        <span className="t-caption mt-4 inline-block"
                              style={{ color: 'oklch(0.78 0.012 70)' }}>
                            Ibn Battuta &middot; b. 1304 &mdash; d. 1369
                        </span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
