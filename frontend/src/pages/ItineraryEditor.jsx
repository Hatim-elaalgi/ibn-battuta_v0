import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useItinerary from '../hooks/useItinerary';

// ─── Inline editable text (auto-saves on blur or Enter) ─────────────────────
function Editable({ value, onChange, multiline = false, className = '', placeholder = '', style = {}, readOnly = false }) {
    const [draft, setDraft]       = useState(value ?? '');
    const [editing, setEditing]   = useState(false);

    React.useEffect(() => { if (!editing) setDraft(value ?? ''); }, [value, editing]);

    const commit = () => {
        setEditing(false);
        if ((draft ?? '') !== (value ?? '')) onChange(draft);
    };

    if (multiline) {
        return (
            <textarea
                value={draft}
                placeholder={readOnly ? '' : placeholder}
                readOnly={readOnly}
                onChange={(e) => { if (!readOnly) setDraft(e.target.value); }}
                onFocus={() => { if (!readOnly) setEditing(true); }}
                onBlur={commit}
                className={`w-full bg-transparent border-0 outline-none ${readOnly ? 'cursor-default' : 'focus:bg-bone-deep/50'} resize-none transition-colors ${className}`}
                rows={Math.max(3, Math.ceil((draft || '').length / 60))}
                style={style}
            />
        );
    }
    return (
        <input
            value={draft}
            placeholder={readOnly ? '' : placeholder}
            readOnly={readOnly}
            onChange={(e) => { if (!readOnly) setDraft(e.target.value); }}
            onFocus={() => { if (!readOnly) setEditing(true); }}
            onBlur={commit}
            onKeyDown={(e) => { if (!readOnly && e.key === 'Enter') { e.target.blur(); } }}
            className={`bg-transparent border-0 outline-none ${readOnly ? 'cursor-default' : 'focus:bg-bone-deep/50'} transition-colors ${className}`}
            style={style}
        />
    );
}

// ─── Single stop card ───────────────────────────────────────────────────────
function StopCard({ stop, dayNumber, isFirst, isLast, onMove, onUpdate, onDelete, onRegenerate, saving, readOnly = false }) {
    const [busy, setBusy] = useState(false);

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.4, ease: [0.2, 0.65, 0.2, 1] }}
            className={`py-6 border-b border-line-soft ${readOnly ? 'grid grid-cols-[80px_1fr] gap-x-6' : 'grid grid-cols-[80px_1fr_auto] gap-x-6'}`}
        >
            {/* Time column */}
            <div>
                <Editable
                    value={stop.start_time || ''}
                    onChange={(v) => onUpdate({ start_time: v })}
                    placeholder="HH:MM"
                    className="tabular text-[20px] w-full"
                    style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.01em' }}
                    readOnly={readOnly}
                />
                <div className="t-caption mt-1 flex items-baseline gap-1">
                    <Editable
                        value={String(stop.duration_minutes || 60)}
                        onChange={(v) => {
                            const n = parseInt(v, 10);
                            if (!Number.isNaN(n) && n > 0) onUpdate({ duration_minutes: n });
                        }}
                        className="tabular w-10"
                        style={{ fontSize: '11px', textTransform: 'none', letterSpacing: '0.04em' }}
                        readOnly={readOnly}
                    />
                    <span style={{ fontSize: '10px' }}>min</span>
                </div>
            </div>

            {/* Body column */}
            <div className="min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-base flex-shrink-0">{stop.emoji || '◇'}</span>
                    <h3 className="leading-tight"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   '24px',
                            letterSpacing: '-0.012em',
                        }}>
                        {stop.name || 'Untitled stop'}
                    </h3>
                    {stop.city && (
                        <span className="t-caption">— {stop.city}</span>
                    )}
                </div>

                <Editable
                    value={stop.notes || ''}
                    onChange={(v) => onUpdate({ notes: v })}
                    multiline
                    placeholder="Click to write the narration…"
                    className="mt-3 italic"
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontStyle:  'italic',
                        fontSize:   '16px',
                        lineHeight: 1.5,
                        color:      'var(--color-ink)',
                    }}
                    readOnly={readOnly}
                />
            </div>

            {/* Actions column — hidden in read-only mode */}
            {!readOnly && (
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                        onClick={() => onMove(-1)}
                        disabled={isFirst}
                        className="t-caption hover:text-ink disabled:opacity-30 transition-colors"
                        title="Move up · earlier"
                    >↑</button>
                    <button
                        onClick={() => onMove(+1)}
                        disabled={isLast}
                        className="t-caption hover:text-ink disabled:opacity-30 transition-colors"
                        title="Move down · later"
                    >↓</button>
                    {stop.place_id && (
                        <button
                            onClick={async () => { setBusy(true); await onRegenerate(); setBusy(false); }}
                            disabled={busy || saving}
                            className="t-caption hover:text-ink disabled:opacity-30 transition-colors"
                            title="Re-narrate this stop"
                        >
                            {busy ? '⁂…' : '↻'}
                        </button>
                    )}
                    <button
                        onClick={onDelete}
                        className="t-caption hover:text-ochre-deep transition-colors"
                        title="Remove this stop"
                    >✕</button>
                </div>
            )}
        </motion.li>
    );
}

// ─── Day section ────────────────────────────────────────────────────────────
function DaySection({ day, isActive, onActivate, onUpdate, onUpdateStop, onMoveStop, onDeleteStop, onRegenerateStop, onAddStop, saving, readOnly = false }) {
    return (
        <section
            id={`day-${day.day_number}`}
            className={`pb-12 ${isActive ? '' : 'opacity-90'}`}
            onMouseEnter={onActivate}
        >
            <header className="pt-10 pb-3 border-b border-line">
                <div className="flex items-baseline justify-between gap-6 flex-wrap">
                    <div>
                        <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                            — Day {day.day_number} · {day.city}
                        </div>
                        <Editable
                            value={day.theme || ''}
                            onChange={(v) => onUpdate({ theme: v })}
                            placeholder="Day theme…"
                            className="mt-2"
                            style={{
                                fontFamily: 'var(--font-display)',
                                fontStyle:  'italic',
                                fontWeight: 300,
                                fontSize:   '40px',
                                letterSpacing: '-0.012em',
                                lineHeight: 1.05,
                                width: '100%',
                            }}
                            readOnly={readOnly}
                        />
                    </div>
                </div>
                <Editable
                    value={day.summary || ''}
                    onChange={(v) => onUpdate({ summary: v })}
                    multiline
                    placeholder="One-sentence summary of the day…"
                    className="mt-4 italic"
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontStyle:  'italic',
                        fontSize:   '17px',
                        color:      'var(--color-ink-soft)',
                        lineHeight: 1.4,
                    }}
                    readOnly={readOnly}
                />
            </header>

            <ul className="mt-2">
                <AnimatePresence>
                    {day.stops.map((stop, i) => (
                        <StopCard
                            key={stop.id}
                            stop={stop}
                            dayNumber={day.day_number}
                            isFirst={i === 0}
                            isLast={i === day.stops.length - 1}
                            onMove={(dir) => onMoveStop(day.day_number, stop.id, dir)}
                            onUpdate={(fields) => onUpdateStop(stop.id, fields)}
                            onDelete={() => onDeleteStop(stop.id)}
                            onRegenerate={() => onRegenerateStop(stop.id)}
                            saving={saving}
                            readOnly={readOnly}
                        />
                    ))}
                </AnimatePresence>
            </ul>

            {!readOnly && (
                <button
                    onClick={() => onAddStop(day.day_number)}
                    className="mt-4 t-caption hover:text-ink transition-colors"
                >
                    + Add a stop to day {day.day_number}
                </button>
            )}
        </section>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ItineraryEditor() {
    const { token }  = useParams();
    const navigate   = useNavigate();
    const location   = useLocation();
    const readOnly   = location.pathname.startsWith('/shared/');
    const {
        data, loading, saving, error,
        updateTitle, updateDay, updateStop,
        moveStop, deleteStop, regenerateStop, addStop,
    } = useItinerary(token);

    const [activeDay, setActiveDay] = useState(1);
    const [shareOpen, setShareOpen] = useState(false);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-bone">
                <div className="text-center">
                    <span className="text-ochre"
                          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '40px' }}>
                        ⁂
                    </span>
                    <p className="t-caption mt-3">— Reading your itinerary</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="h-full flex items-center justify-center bg-bone">
                <div className="text-center max-w-md">
                    <p className="t-lede italic">— No journey at this address.</p>
                    <button onClick={() => navigate('/create')}
                            className="t-caption mt-6 hover:text-ink"
                            style={{ color: 'var(--color-ochre)' }}>
                        ↵ Begin a new one
                    </button>
                </div>
            </div>
        );
    }

    const handleAddStop = (day_number) => {
        const name = window.prompt('Name of the stop?');
        if (!name) return;
        addStop(day_number, { custom_name: name, duration_minutes: 60 });
    };

    const shareUrl = `${window.location.origin}/shared/${data.view_token}`;
    const totalStops = data.days.reduce((acc, d) => acc + d.stops.length, 0);

    return (
        <div className="h-full overflow-y-auto bg-bone">

            {/* ── Sticky save indicator ─────────────────────────── */}
            <AnimatePresence>
                {saving && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="sticky top-0 z-40 bg-bone border-b border-line-soft pointer-events-none"
                    >
                        <div className="max-w-4xl mx-auto px-7 md:px-12 py-1.5 t-caption flex items-center gap-2"
                             style={{ color: 'var(--color-ochre)' }}>
                            <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                            >●</motion.span>
                            Saving…
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto px-7 md:px-12 py-12">

                {/* Plate caption + toolbar */}
                <div className="flex items-baseline justify-between gap-6 flex-wrap">
                    <div className="t-caption">— Plate XI · Itinerary</div>
                    <div className="flex items-baseline gap-5">
                        <span className="t-caption tabular">
                            {data.num_days} days · {totalStops} stops
                        </span>
                        {readOnly ? (
                            <span className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                — View only
                            </span>
                        ) : (
                            <button
                                onClick={() => setShareOpen(s => !s)}
                                className="t-caption hover:text-ink transition-colors"
                                style={{ color: shareOpen ? 'var(--color-ochre)' : undefined }}
                            >
                                ↵ Share
                            </button>
                        )}
                    </div>
                </div>

                {/* Title */}
                <Editable
                    value={data.title}
                    onChange={updateTitle}
                    className="block mt-3 leading-none"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontStyle:  'italic',
                        fontWeight: 300,
                        fontSize:   'clamp(40px, 6vw, 72px)',
                        letterSpacing: '-0.02em',
                        width: '100%',
                    }}
                    readOnly={readOnly}
                />

                {/* Sub-line */}
                <div className="mt-3 flex items-baseline gap-3 t-caption">
                    <span>Beginning in {data.start_city}</span>
                    {data.traveler_profile?.pace && (
                        <span>· {data.traveler_profile.pace} pace</span>
                    )}
                    {data.traveler_profile?.budget_tier && (
                        <span>· {data.traveler_profile.budget_tier} budget</span>
                    )}
                </div>

                {/* Share strip */}
                <AnimatePresence>
                    {shareOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4, ease: [0.2, 0.65, 0.2, 1] }}
                            className="mt-6 overflow-hidden"
                        >
                            <div className="border border-line-soft p-5 bg-bone-deep">
                                <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                    — Read-only public URL
                                </div>
                                <div className="mt-2 flex items-center gap-3">
                                    <code className="flex-1 truncate text-[13px]"
                                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)' }}>
                                        {shareUrl}
                                    </code>
                                    <button
                                        onClick={() => navigator.clipboard?.writeText(shareUrl)}
                                        className="t-caption hover:text-ink transition-colors"
                                    >
                                        ↵ Copy
                                    </button>
                                </div>
                                <p className="t-caption italic mt-3"
                                   style={{ textTransform: 'none', letterSpacing: '0.04em', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '12px' }}>
                                    — Anyone with this link can view but not edit. Your edit URL stays private.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Days */}
                {data.days.map(d => (
                    <DaySection
                        key={d.id}
                        day={d}
                        isActive={activeDay === d.day_number}
                        onActivate={() => setActiveDay(d.day_number)}
                        onUpdate={(fields) => updateDay(d.day_number, fields)}
                        onUpdateStop={updateStop}
                        onMoveStop={moveStop}
                        onDeleteStop={deleteStop}
                        onRegenerateStop={regenerateStop}
                        onAddStop={handleAddStop}
                        saving={saving}
                        readOnly={readOnly}
                    />
                ))}

                {/* Footer */}
                <div className="mt-16 pt-10 border-t border-line text-center">
                    <span className="text-ochre"
                          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '32px' }}>
                        ⁂
                    </span>
                    <p className="t-lede italic mt-4" style={{ fontSize: '15px' }}>
                        {readOnly
                            ? '— A journey, shared for reading.'
                            : '— Edit anywhere. Changes save themselves.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
