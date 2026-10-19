import { useCallback, useEffect, useRef, useState } from 'react';

const API = 'http://127.0.0.1:8000/api/v1/itineraries';

/**
 * Loads an itinerary by token, exposes mutation helpers with debounced auto-save.
 */
export default function useItinerary(token) {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [error,   setError]   = useState(null);

    // Initial load
    useEffect(() => {
        let cancelled = false;
        if (!token) return;
        setLoading(true);
        fetch(`${API}/${token}`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(json => { if (!cancelled) { setData(json); setError(null); } })
            .catch(e => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token]);

    // Send a PATCH and replace state with response
    const sendPatch = useCallback(async (body) => {
        if (!token) return;
        setSaving(true);
        try {
            const r = await fetch(`${API}/${token}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setData(await r.json());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }, [token]);

    // Debounced version
    const debounceTimers = useRef({});
    const sendPatchDebounced = useCallback((key, body, delay = 700) => {
        clearTimeout(debounceTimers.current[key]);
        debounceTimers.current[key] = setTimeout(() => sendPatch(body), delay);
    }, [sendPatch]);

    // ── High-level mutations ────────────────────────────────────────────────
    const updateTitle = (title) => sendPatchDebounced('title', { title });

    const updateDay = (day_number, fields) =>
        sendPatchDebounced(`day-${day_number}`, { day: { day_number, ...fields } });

    const updateStop = (stop_id, fields) =>
        sendPatchDebounced(`stop-${stop_id}`, { stop: { id: stop_id, ...fields } });

    const reorderStops = (day_number, stop_ids) =>
        sendPatch({ day: { day_number, reorder: stop_ids } });

    const moveStop = async (day_number, stop_id, direction /* -1 or +1 */) => {
        if (!data) return;
        const day = data.days.find(d => d.day_number === day_number);
        if (!day) return;
        const ids = day.stops.map(s => s.id);
        const idx = ids.indexOf(stop_id);
        const nidx = idx + direction;
        if (idx < 0 || nidx < 0 || nidx >= ids.length) return;
        [ids[idx], ids[nidx]] = [ids[nidx], ids[idx]];
        await reorderStops(day_number, ids);
    };

    const deleteStop = async (stop_id) => {
        const r = await fetch(`${API}/${token}/stops/${stop_id}`, { method: 'DELETE' });
        if (r.ok) setData(await r.json());
    };

    const addStop = async (day_number, body) => {
        const r = await fetch(`${API}/${token}/stops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day_number, ...body }),
        });
        if (r.ok) setData(await r.json());
    };

    const regenerateStop = async (stop_id) => {
        setSaving(true);
        try {
            const r = await fetch(`${API}/${token}/regenerate-stop/${stop_id}`, { method: 'POST' });
            if (r.ok) setData(await r.json());
        } finally {
            setSaving(false);
        }
    };

    return {
        data, loading, saving, error,
        updateTitle, updateDay, updateStop,
        moveStop, reorderStops, deleteStop, addStop,
        regenerateStop,
    };
}
