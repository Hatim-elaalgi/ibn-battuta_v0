import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useMyJourneys from '../hooks/useMyJourneys';

const CITIES = ['Tangier', 'Asilah', 'Tetouan', 'Chefchaouen', 'Fnideq'];

const INTERESTS = [
    { key: 'history',     label: 'History' },
    { key: 'culture',     label: 'Culture' },
    { key: 'food',        label: 'Food' },
    { key: 'nature',      label: 'Nature' },
    { key: 'beach',       label: 'Beach' },
    { key: 'viewpoint',   label: 'Viewpoints' },
    { key: 'photography', label: 'Photography' },
    { key: 'hidden_gems', label: 'Hidden gems' },
];

const PACE = [
    { key: 'slow',     label: 'Slow' },
    { key: 'balanced', label: 'Balanced' },
    { key: 'packed',   label: 'Packed' },
];

const BUDGET = [
    { key: 'budget',  label: 'Routard' },
    { key: 'mid',     label: 'Confort' },
    { key: 'splurge', label: 'Luxe' },
];

// ─── Compact toggle pill ────────────────────────────────────────────────────
function Pill({ on, label, onClick, kbd }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-baseline gap-2 px-3 py-1.5 transition-colors duration-300 ${
                on ? 'text-ink' : 'text-ink-mute hover:text-ink'
            }`}
        >
            <span className="text-[8px] leading-none"
                  style={{ color: on ? 'var(--color-ochre)' : 'oklch(0.78 0.012 70)' }}>
                {on ? '●' : '○'}
            </span>
            <span className="text-[13px]" style={{ fontFamily: 'var(--font-body)' }}>
                {label}
            </span>
            {kbd && (
                <span className="t-caption" style={{ fontSize: '9px' }}>{kbd}</span>
            )}
        </button>
    );
}

function Field({ label, children, hint }) {
    return (
        <div className="grid md:grid-cols-[180px_1fr] gap-x-8 gap-y-2 py-5 border-b border-line-soft">
            <div>
                <div className="t-caption">— {label}</div>
                {hint && <div className="t-caption mt-1" style={{ fontSize: '10px', textTransform: 'none', letterSpacing: '0.04em', fontStyle: 'italic' }}>{hint}</div>}
            </div>
            <div>{children}</div>
        </div>
    );
}

// ─── Streaming progress overlay ─────────────────────────────────────────────
function GenerationOverlay({ events, onCancel }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-bone/95 backdrop-blur-sm flex flex-col items-center justify-center px-7"
        >
            <div className="text-center max-w-2xl">
                <span className="text-ochre"
                      style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '52px', lineHeight: 1 }}>
                    ⁂
                </span>
                <h2 className="mt-7 leading-tight"
                    style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '40px', letterSpacing: '-0.012em' }}>
                    He is reading the map.
                </h2>
                <p className="t-lede italic mt-4" style={{ fontSize: '17px' }}>
                    Plotting your days. This will take a minute.
                </p>
            </div>

            <div className="mt-12 w-full max-w-xl border-y border-line py-5">
                {events.length === 0 ? (
                    <p className="t-caption text-center">— Connecting to the wires</p>
                ) : (
                    <ul className="space-y-2">
                        {events.slice(-6).map((e, i) => (
                            <motion.li
                                key={e.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1 - i * 0.15, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="t-caption flex items-baseline gap-3"
                            >
                                <span style={{ color: 'var(--color-ochre)' }}>●</span>
                                <span style={{ textTransform: 'none', letterSpacing: '0.04em', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '14px' }}>
                                    {e.label}
                                </span>
                            </motion.li>
                        ))}
                    </ul>
                )}
            </div>

            <button
                onClick={onCancel}
                className="t-caption mt-10 hover:text-ink transition-colors"
            >
                ↵ Cancel
            </button>
        </motion.div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function Create() {
    const navigate = useNavigate();
    const { saveJourney } = useMyJourneys();

    const [city,       setCity]       = useState('Tangier');
    const [numDays,    setNumDays]    = useState(3);
    const [partySize,  setPartySize]  = useState(2);
    const [pace,       setPace]       = useState('balanced');
    const [budget,     setBudget]     = useState('mid');
    const [interests,  setInterests]  = useState(['culture', 'food']);
    const [notes,      setNotes]      = useState('');

    const [generating, setGenerating] = useState(false);
    const [events,     setEvents]     = useState([]);
    const [error,      setError]      = useState(null);
    const abortRef = useRef(null);

    const toggleInterest = (k) => setInterests(prev =>
        prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    );

    const pushEvent = (label) => setEvents(prev => [...prev, { id: Date.now() + Math.random(), label }]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (generating) return;
        setError(null);
        setEvents([]);
        setGenerating(true);

        const ctrl = new AbortController();
        abortRef.current = ctrl;

        try {
            const resp = await fetch('http://127.0.0.1:8000/api/v1/itineraries/generate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city, num_days: numDays, party_size: partySize,
                    pace, budget_tier: budget, interests, notes,
                }),
                signal: ctrl.signal,
            });
            if (!resp.ok) throw new Error(`Backend ${resp.status}`);

            const reader  = resp.body.getReader();
            const decoder = new TextDecoder();
            let   buffer  = '';
            let   editToken = null;
            let   generatedTitle = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (!raw) continue;
                    let evt; try { evt = JSON.parse(raw); } catch { continue; }

                    if (evt.type === 'phase')              pushEvent(evt.label);
                    else if (evt.type === 'plan_ready') {
                        generatedTitle = evt.title;
                        pushEvent(`Title: ${evt.title}`);
                    }
                    else if (evt.type === 'day_stops_ready')      pushEvent(`Day ${evt.day} — ${evt.stops?.length ?? 0} stops chosen`);
                    else if (evt.type === 'day_narration_ready')  pushEvent(`Day ${evt.day} — narration written`);
                    else if (evt.type === 'persisted')     editToken = evt.edit_token;
                    else if (evt.type === 'error')         throw new Error(evt.message);
                    else if (evt.type === 'done') {
                        if (editToken) {
                            saveJourney(editToken, generatedTitle, city);
                            navigate(`/itinerary/${editToken}`);
                        } else throw new Error('Generation finished without a token');
                    }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                setGenerating(false);
                return;
            }
            setError(err.message || 'Generation failed');
            setGenerating(false);
        }
    }

    function handleCancel() {
        abortRef.current?.abort();
        setGenerating(false);
    }

    return (
        <div className="relative h-full overflow-y-auto bg-bone">
            <div className="max-w-3xl mx-auto px-7 md:px-12 py-12">

                <div className="t-caption">— Plate X · Begin a journey</div>

                <h1 className="mt-3 leading-none"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontStyle:  'italic',
                        fontWeight: 300,
                        fontSize:   'clamp(40px, 6vw, 72px)',
                        letterSpacing: '-0.02em',
                    }}>
                    Tell me<br />where to begin.
                </h1>

                <p className="t-lede italic mt-7" style={{ fontSize: '17px' }}>
                    A few choices. Then the traveller will plan your days, in his voice.
                </p>

                <form onSubmit={handleSubmit} className="mt-12">

                    <Field label="Start in" hint="The city you arrive in.">
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {CITIES.map(c => (
                                <Pill key={c} on={city === c} label={c} onClick={() => setCity(c)} />
                            ))}
                        </div>
                    </Field>

                    <Field label="How many days" hint="2 to 14.">
                        <div className="flex items-baseline gap-4">
                            <input
                                type="range"
                                min="2" max="14"
                                value={numDays}
                                onChange={(e) => setNumDays(Number(e.target.value))}
                                className="flex-1 accent-ochre max-w-xs"
                            />
                            <span className="tabular text-[24px]"
                                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}>
                                {numDays}
                            </span>
                            <span className="t-caption">{numDays === 1 ? 'day' : 'days'}</span>
                        </div>
                    </Field>

                    <Field label="Travelling as">
                        <div className="flex items-baseline gap-3">
                            <input
                                type="number" min="1" max="12"
                                value={partySize}
                                onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                                className="w-16 bg-transparent border-0 border-b border-line text-[20px] text-center outline-none focus:border-ochre"
                                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
                            />
                            <span className="t-caption">{partySize === 1 ? 'traveller' : 'travellers'}</span>
                        </div>
                    </Field>

                    <Field label="Interests" hint="Pick a few. He will balance the days.">
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {INTERESTS.map(i => (
                                <Pill key={i.key} on={interests.includes(i.key)}
                                      label={i.label} onClick={() => toggleInterest(i.key)} />
                            ))}
                        </div>
                    </Field>

                    <Field label="Pace">
                        <div className="flex flex-wrap gap-x-2">
                            {PACE.map(p => (
                                <Pill key={p.key} on={pace === p.key}
                                      label={p.label} onClick={() => setPace(p.key)} />
                            ))}
                        </div>
                    </Field>

                    <Field label="Budget">
                        <div className="flex flex-wrap gap-x-2">
                            {BUDGET.map(b => (
                                <Pill key={b.key} on={budget === b.key}
                                      label={b.label} onClick={() => setBudget(b.key)} />
                            ))}
                        </div>
                    </Field>

                    <Field label="Notes" hint="Anything else he should know.">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="On adore la photo, on déteste les groupes…"
                            rows={3}
                            className="w-full bg-transparent border-0 border-b border-line outline-none focus:border-ochre py-2 italic text-[15px] resize-none"
                            style={{ fontFamily: 'var(--font-body)' }}
                        />
                    </Field>

                    {/* Submit */}
                    <div className="mt-12 flex items-baseline gap-7 flex-wrap">
                        <button
                            type="submit"
                            disabled={generating || interests.length === 0}
                            className="group inline-flex items-baseline gap-3 px-9 py-4 bg-ink text-bone hover:bg-ochre transition-colors duration-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle:  'italic',
                                fontWeight: 300,
                                fontSize:   '20px',
                                letterSpacing: '0.01em',
                            }}
                        >
                            Plan my journey
                            <span className="transition-transform duration-500 group-hover:translate-x-1">&nbsp;→</span>
                        </button>
                        {interests.length === 0 && (
                            <span className="t-caption italic"
                                  style={{ textTransform: 'none', letterSpacing: '0.04em', fontStyle: 'italic', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                                — Pick at least one interest.
                            </span>
                        )}
                        {error && (
                            <span className="t-caption" style={{ color: 'var(--color-ochre-deep)' }}>
                                — {error}
                            </span>
                        )}
                    </div>
                </form>
            </div>

            <AnimatePresence>
                {generating && (
                    <GenerationOverlay events={events} onCancel={handleCancel} />
                )}
            </AnimatePresence>
        </div>
    );
}
