import { useEffect, useState } from 'react';

/**
 * Fetch Tangier live data by opening the SSE chat stream and reading just
 * the `meta` event (which carries the live block). Aborts before any LLM
 * tokens are generated, so the cost is one parallel live-data fetch.
 *
 * Refreshes every `intervalMs` (default 10 min — server caches 10 min anyway).
 */
export default function useTangierLive(intervalMs = 600_000) {
    const [live,    setLive]    = useState(null);
    const [error,   setError]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [tick,    setTick]    = useState(0);

    useEffect(() => {
        let cancelled = false;
        let abort     = new AbortController();

        async function go() {
            setLoading(true);
            try {
                const resp = await fetch('http://127.0.0.1:8000/api/v1/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message:   '_live',
                        city:      'Tangier',
                        latitude:  35.7595,
                        longitude: -5.8340,
                    }),
                    signal: abort.signal,
                });

                if (!resp.ok) throw new Error(`Backend ${resp.status}`);

                const reader  = resp.body.getReader();
                const decoder = new TextDecoder();
                let   buffer  = '';

                outer: while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        try {
                            const evt = JSON.parse(line.slice(5).trim());
                            if (evt.type === 'meta' && !cancelled) {
                                setLive(evt.live || null);
                                setError(null);
                                setLoading(false);
                                abort.abort();   // we only want the meta
                                break outer;
                            }
                        } catch { /* ignore parse glitches */ }
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                if (!cancelled) {
                    setError(err);
                    setLoading(false);
                }
            }
        }

        go();
        const id = setInterval(() => setTick(t => t + 1), intervalMs);
        return () => {
            cancelled = true;
            clearInterval(id);
            try { abort.abort(); } catch {}
        };
    }, [tick, intervalMs]);

    return { live, error, loading, refresh: () => setTick(t => t + 1) };
}
