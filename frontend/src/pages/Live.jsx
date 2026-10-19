import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTangierLive from '../hooks/useTangierLive';

const PRAYERS = [
    { key: 'Fajr',    label: 'Fajr' },
    { key: 'Dhuhr',   label: 'Dhuhr' },
    { key: 'Asr',     label: 'Asr' },
    { key: 'Maghrib', label: 'Maghrib' },
    { key: 'Isha',    label: 'Isha' },
];

function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

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

function timeUntil(at, now) {
    if (!at || !/^\d{1,2}:\d{2}/.test(at)) return null;
    const [h, m] = at.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    let diff = target - now;
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    const totalS = Math.round(diff / 1000);
    const hours  = Math.floor(totalS / 3600);
    const mins   = Math.floor((totalS % 3600) / 60);
    const secs   = totalS % 60;
    if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Live() {
    const { live, loading, error, refresh } = useTangierLive();
    const now = useNow(1000);

    const next = live?.prayer_times ? nextPrayer(live.prayer_times, now) : null;

    return (
        <div className="h-full overflow-y-auto bg-bone">
            <div className="max-w-6xl mx-auto px-7 md:px-12 py-12">

                {/* Plate caption */}
                <div className="t-caption">— Plate VIII · Live now</div>

                {/* Title row */}
                <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
                    <div>
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
                            The city,<br />this hour.
                        </h1>
                    </div>
                    <div className="text-right">
                        <div className="t-caption tabular" style={{ color: 'var(--color-ochre)' }}>
                            <span>●</span><span className="ml-2">{now.toTimeString().slice(0, 8)}</span>
                        </div>
                        <button
                            onClick={refresh}
                            className="t-caption mt-2 hover:text-ink transition-colors"
                        >
                            ↻ Refresh
                        </button>
                    </div>
                </div>

                {/* Loading / error */}
                {loading && (
                    <div className="mt-16 flex items-center gap-3">
                        <motion.span
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                            className="text-ochre text-xs"
                        >●</motion.span>
                        <span className="t-caption">Reading the wires from Tangier</span>
                    </div>
                )}
                {error && (
                    <div className="mt-12 t-lede italic" style={{ color: 'var(--color-ink-soft)' }}>
                        — The wires are quiet. Is the backend running?
                    </div>
                )}

                <AnimatePresence>
                    {live && !loading && (
                        <motion.div
                            key="live-content"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
                            className="mt-14"
                        >
                            {/* HERO ROW — weather + next prayer ─────────── */}
                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-10 border-y border-line py-10">

                                {/* Weather */}
                                <div>
                                    <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                        — Sky &amp; air
                                    </div>
                                    <div className="mt-4 flex items-baseline gap-5"
                                         style={{ fontFamily: 'var(--font-display)' }}>
                                        {live.weather?.temperature_c != null && (
                                            <span style={{
                                                fontStyle: 'italic',
                                                fontWeight: 300,
                                                fontSize: 'clamp(72px, 9vw, 120px)',
                                                lineHeight: 1,
                                                letterSpacing: '-0.03em',
                                                color: 'var(--color-ink)',
                                            }}>
                                                {Math.round(live.weather.temperature_c)}°
                                            </span>
                                        )}
                                        <div>
                                            <p style={{
                                                fontStyle: 'italic',
                                                fontWeight: 300,
                                                fontSize: '24px',
                                                letterSpacing: '-0.012em',
                                            }}>
                                                {live.weather?.description || '—'}
                                            </p>
                                            {live.weather?.wind_kph != null && (
                                                <p className="t-caption tabular mt-2"
                                                   style={{ letterSpacing: '0.04em' }}>
                                                    wind {Math.round(live.weather.wind_kph)} km/h
                                                </p>
                                            )}
                                            {live.air_quality?.label && (
                                                <p className="t-caption mt-1">
                                                    air · {live.air_quality.label.toLowerCase()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Next prayer countdown */}
                                <div>
                                    <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                        — Next call to prayer
                                    </div>
                                    {next ? (
                                        <div className="mt-4">
                                            <p style={{
                                                fontFamily: 'var(--font-display)',
                                                fontStyle: 'italic',
                                                fontWeight: 300,
                                                fontSize: 'clamp(56px, 7vw, 88px)',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em',
                                                color: 'var(--color-ink)',
                                            }}>
                                                {next.label}{next.tomorrow ? ' (tomorrow)' : ''}
                                            </p>
                                            <p className="mt-3 t-caption tabular"
                                               style={{ letterSpacing: '0.04em', fontSize: '13px' }}>
                                                <span>{next.at}</span>
                                                {!next.tomorrow && (
                                                    <span className="ml-3" style={{ color: 'var(--color-ochre)' }}>
                                                        in {timeUntil(next.at, now)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="t-lede italic mt-4">— Times unknown.</p>
                                    )}

                                    {live.prayer_times?.Fajr && (
                                        <div className="mt-7 grid grid-cols-5 gap-3">
                                            {PRAYERS.map(p => (
                                                <div key={p.key} className="text-center">
                                                    <div className="t-caption" style={{ fontSize: '9px' }}>
                                                        {p.label}
                                                    </div>
                                                    <div className="t-caption tabular mt-1"
                                                         style={{
                                                             color: next?.key === p.key && !next?.tomorrow
                                                                 ? 'var(--color-ochre)'
                                                                 : 'var(--color-ink-soft)',
                                                             letterSpacing: '0.04em',
                                                             textTransform: 'none',
                                                             fontSize: '13px',
                                                             fontFamily: 'var(--font-mono)',
                                                         }}>
                                                        {live.prayer_times[p.key] || '—'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECONDARY ROWS ─────────────────────────────── */}
                            <div className="grid md:grid-cols-3 gap-x-12 gap-y-10 mt-12">

                                {/* Events */}
                                <Section title="This week" accent>
                                    {live.events?.length ? live.events.slice(0, 4).map((e, i) => (
                                        <div key={i} className={i > 0 ? 'pt-4 mt-4 border-t border-line-soft' : ''}>
                                            <p className="italic" style={{ fontFamily: 'var(--font-body)', fontSize: '17px' }}>
                                                {e.name}
                                            </p>
                                            <p className="t-caption mt-1">
                                                {[e.date, e.venue].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                    )) : <p className="t-lede italic">— Quiet.</p>}
                                </Section>

                                {/* Tables */}
                                <Section title="Tables">
                                    {live.restaurants?.length ? live.restaurants.slice(0, 6).map((r, i) => (
                                        <p key={i} className={`italic ${i > 0 ? 'mt-2' : ''}`}
                                           style={{ fontFamily: 'var(--font-body)', fontSize: '16px' }}>
                                            {r.name}
                                            {r.cuisine && (
                                                <span className="t-caption ml-2" style={{ fontSize: '9px' }}>
                                                    — {r.cuisine}
                                                </span>
                                            )}
                                        </p>
                                    )) : <p className="t-lede italic">— None listed.</p>}
                                </Section>

                                {/* News */}
                                <Section title="From the wires">
                                    {live.news?.length ? live.news.slice(0, 4).map((n, i) => (
                                        <div key={i} className={i > 0 ? 'pt-3 mt-3 border-t border-line-soft' : ''}>
                                            <p className="italic" style={{ fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: 1.4 }}>
                                                {n.title}
                                            </p>
                                            <p className="t-caption mt-1">— {n.source}</p>
                                        </div>
                                    )) : <p className="t-lede italic">— Quiet.</p>}
                                </Section>

                                {/* Country / next holiday */}
                                {(live.next_holiday || live.country_info) && (
                                    <Section title="Almanac">
                                        {live.next_holiday && (
                                            <div>
                                                <p className="t-caption">— Next holiday</p>
                                                <p className="italic mt-1"
                                                   style={{ fontFamily: 'var(--font-body)', fontSize: '17px' }}>
                                                    {live.next_holiday.name}
                                                </p>
                                                <p className="t-caption tabular mt-1">
                                                    {live.next_holiday.date}
                                                </p>
                                            </div>
                                        )}
                                        {live.country_info?.currency && (
                                            <div className="mt-4 pt-4 border-t border-line-soft">
                                                <p className="t-caption">— Currency</p>
                                                <p className="italic mt-1"
                                                   style={{ fontFamily: 'var(--font-body)', fontSize: '17px' }}>
                                                    {live.country_info.currency}
                                                </p>
                                            </div>
                                        )}
                                    </Section>
                                )}

                                {/* Attractions */}
                                {live.attractions?.length > 0 && (
                                    <Section title="Plates & pillars">
                                        {live.attractions.slice(0, 6).map((a, i) => (
                                            <p key={i} className={`italic ${i > 0 ? 'mt-2' : ''}`}
                                               style={{ fontFamily: 'var(--font-body)', fontSize: '16px' }}>
                                                {a.name}
                                            </p>
                                        ))}
                                    </Section>
                                )}

                                {/* Wikipedia summary */}
                                {live.wiki_summary && (
                                    <Section title="In one paragraph">
                                        <p className="italic"
                                           style={{ fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: 1.55 }}>
                                            {live.wiki_summary}
                                        </p>
                                    </Section>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ─── Reusable column section ────────────────────────────────────────────────
function Section({ title, accent = false, children }) {
    return (
        <div>
            <div className="t-caption pb-3 border-b border-line"
                 style={{ color: accent ? 'var(--color-ochre)' : undefined }}>
                — {title}
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}
