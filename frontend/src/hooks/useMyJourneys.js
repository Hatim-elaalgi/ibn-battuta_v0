import { useCallback, useState } from 'react';

const STORAGE_KEY = 'my-journeys-v1';

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

export default function useMyJourneys() {
    const [journeys, setJourneys] = useState(load);

    const saveJourney = useCallback((token, title, city) => {
        setJourneys(prev => {
            if (prev.some(j => j.token === token)) return prev;
            const next = [
                { token, title: title || 'A journey', city: city || 'Tangier', created_at: new Date().toISOString() },
                ...prev,
            ].slice(0, 20);   // keep last 20
            save(next);
            return next;
        });
    }, []);

    const removeJourney = useCallback((token) => {
        setJourneys(prev => {
            const next = prev.filter(j => j.token !== token);
            save(next);
            return next;
        });
    }, []);

    return { journeys, saveJourney, removeJourney };
}
