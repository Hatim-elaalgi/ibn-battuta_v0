import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// ── Live clock — re-renders every minute ─────────────────────────────────────
function useNow(intervalMs = 30_000) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

// ── Time-of-day countdown to next prayer ─────────────────────────────────────
function timeUntil(prayerTime, now) {
    if (!prayerTime || !/^\d{1,2}:\d{2}/.test(prayerTime)) return null;
    const [h, m] = prayerTime.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    let diff = target - now;
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    const mins  = Math.round(diff / 60_000);
    const hours = Math.floor(mins / 60);
    const rem   = mins % 60;
    return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
}

const PRAYERS = [
    { key: 'Fajr',    label: 'Fajr' },
    { key: 'Dhuhr',   label: 'Dhuhr' },
    { key: 'Asr',     label: 'Asr' },
    { key: 'Maghrib', label: 'Maghrib' },
    { key: 'Isha',    label: 'Isha' },
];

// Find the next prayer relative to now (first one strictly after now)
function nextPrayer(timings, now) {
    if (!timings) return null;
    const cur = now.getHours() * 60 + now.getMinutes();
    for (const p of PRAYERS) {
        const t = timings[p.key];
        if (!t || !/^\d{1,2}:\d{2}/.test(t)) continue;
        const [h, m] = t.split(':').map(Number);
        if (h * 60 + m > cur) return { ...p, at: t };
    }
    return { ...PRAYERS[0], at: timings.Fajr, tomorrow: true };
}

// ─── Empty state — when no live data attached yet ────────────────────────────
function Empty() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <span className="text-ochre text-2xl"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}>
                ⁂
            </span>
            <p className="t-caption mt-3">— Live now</p>
            <p className="t-lede italic mt-3 max-w-xs"
               style={{ fontSize: '15px' }}>
                Ask him about the city. The hour, the weather, the muezzin&rsquo;s next call &mdash; they will appear here as he speaks.
            </p>
        </div>
    );
}

// ─── Single field row ────────────────────────────────────────────────────────
function Field({ label, children, accent = false }) {
    return (
        <div className="py-3 border-b border-line-soft last:border-0">
            <div className="t-caption" style={{ color: accent ? 'var(--color-ochre)' : undefined }}>
                — {label}
            </div>
            <div className="mt-1.5 leading-snug"
                 style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-ink)' }}>
                {children}
            </div>
        </div>
    );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function LivePanel({ live }) {
    const now = useNow(30_000);

    return (
        <div className="relative w-full h-full bg-bone-deep border border-line-soft overflow-hidden">

            {/* Plate caption */}
            <div className="absolute top-3 left-4 t-caption pointer-events-none">
                — Plate VII · Live
            </div>

            {/* Live clock */}
            <div className="absolute top-3 right-4 t-caption tabular pointer-events-none"
                 style={{ color: 'var(--color-ochre)' }}>
                <span>●</span>
                <span className="ml-2">{now.toTimeString().slice(0, 5)}</span>
            </div>

            {!live ? (
                <Empty />
            ) : (
                <div className="h-full overflow-y-auto pt-12 px-7 pb-6">

                    {/* Hero stat: weather */}
                    {live.weather?.summary && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="pb-5 border-b border-line"
                        >
                            <div className="t-caption">— In Tangier, this hour</div>
                            <div className="mt-2"
                                 style={{
                                     fontFamily: 'var(--font-display)',
                                     fontStyle:  'italic',
                                     fontWeight: 300,
                                     fontSize:   '26px',
                                     lineHeight: 1.2,
                                     letterSpacing: '-0.012em',
                                 }}>
                                {live.weather.summary.split(',')[0]}
                            </div>
                            {live.weather.temperature_c != null && (
                                <div className="mt-1 flex items-baseline gap-3 t-caption tabular">
                                    <span style={{ color: 'var(--color-ink-soft)', fontSize: '22px', fontFamily: 'var(--font-display)', textTransform: 'none', letterSpacing: 0 }}>
                                        {Math.round(live.weather.temperature_c)}°
                                    </span>
                                    {live.weather.wind_kph != null && (
                                        <span>wind {Math.round(live.weather.wind_kph)} km/h</span>
                                    )}
                                    {live.air_quality?.label && (
                                        <span>· air {live.air_quality.label.toLowerCase()}</span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Prayer schedule with next-up countdown */}
                    {live.prayer_times?.Fajr && (() => {
                        const next = nextPrayer(live.prayer_times, now);
                        return (
                            <div className="py-4 border-b border-line">
                                <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                    — Adhan · next call
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <div style={{
                                        fontFamily: 'var(--font-display)',
                                        fontStyle:  'italic',
                                        fontWeight: 300,
                                        fontSize:   '22px',
                                        letterSpacing: '-0.012em',
                                    }}>
                                        {next?.label || '—'}{next?.tomorrow ? ' (tomorrow)' : ''}
                                    </div>
                                    <div className="t-caption tabular">
                                        <span>{next?.at}</span>
                                        {next && !next.tomorrow && (
                                            <span className="ml-2" style={{ color: 'var(--color-ochre)' }}>
                                                · in {timeUntil(next.at, now)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-5 gap-2">
                                    {PRAYERS.map(p => (
                                        <div key={p.key} className="text-center">
                                            <div className="t-caption" style={{ fontSize: '8px' }}>
                                                {p.label}
                                            </div>
                                            <div className="t-caption tabular mt-0.5"
                                                 style={{
                                                     color: next?.key === p.key && !next?.tomorrow
                                                        ? 'var(--color-ochre)'
                                                        : 'var(--color-ink-soft)',
                                                     letterSpacing: '0.04em',
                                                     textTransform: 'none',
                                                     fontSize: '11px',
                                                 }}>
                                                {live.prayer_times[p.key] || '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Upcoming holiday */}
                    {live.next_holiday && (
                        <Field label={`Next holiday · ${live.next_holiday.date}`}>
                            <em>{live.next_holiday.name}</em>
                        </Field>
                    )}

                    {/* Events this week */}
                    {live.events?.length > 0 && (
                        <Field label="This week" accent>
                            {live.events.slice(0, 3).map((e, i) => (
                                <div key={i} className={i > 0 ? 'mt-2' : ''}>
                                    <em>{e.name}</em>
                                    {e.venue && (
                                        <span className="t-caption ml-2" style={{ fontSize: '9px' }}>
                                            — {e.venue}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </Field>
                    )}

                    {/* Tables */}
                    {live.restaurants?.length > 0 && (
                        <Field label="Tables tonight">
                            {live.restaurants.slice(0, 3).map(r => r.name).join(' · ')}
                        </Field>
                    )}

                    {/* News */}
                    {live.news?.length > 0 && (
                        <Field label={`From the wires · ${live.news[0].source || ''}`}>
                            <em>{live.news[0].title}</em>
                        </Field>
                    )}
                </div>
            )}
        </div>
    );
}
