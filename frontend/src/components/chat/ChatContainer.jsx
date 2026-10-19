import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Ornament from '../ui/Ornament';

// ─── Speech Recognition (STT) ────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

// ─── Sentence splitter for streaming TTS ─────────────────────────────────────
function extractCompleteSentences(text) {
    const match = text.match(/^(.*[.!?…]["']?)\s+([^.!?]*)$/s);
    if (match) return { done: match[1], rest: match[2] };
    return { done: null, rest: text };
}

// ─── Format hh:mm from a Date ────────────────────────────────────────────────
function fmtTime(d) {
    return d.toTimeString().slice(0, 5);
}

// ─── Map routing intent detection ────────────────────────────────────────────
function isRouteIntent(text) {
    return /\b(show.{0,25}map|on the map|reach .+|navigate to|directions to|find .+map|how to get|take me to|where is|help me.*reach|map.*route|route to)\b/i.test(text);
}

// Extract the destination name from a routing request.
// Handles typos like "throw the map" → "through the map".
function extractRouteDestination(text) {
    const patterns = [
        // "reach X through/throw/on/via the map"
        /\breach\s+(.+?)\s+(?:through|throw|via|on|using)\s+(?:the\s+)?map/i,
        // "help me (to) reach X …"
        /\bhelp me\s+(?:to\s+)?reach\s+(.+?)(?:\s+(?:through|throw|via|on|please|restaurant|café|cafe)\b|\s*$)/i,
        // "show (me) X on the map"
        /\bshow\s+(?:me\s+)?(.+?)\s+on\s+(?:the\s+)?map/i,
        // "find X on the map"
        /\bfind\s+(.+?)\s+on\s+(?:the\s+)?map/i,
        // "navigate to X" / "directions to X"
        /\b(?:navigate|directions)\s+to\s+(.+?)(?:\s+please|\s*$)/i,
        // "how (do I/to/can I) get/reach/find (to) X"
        /\bhow\s+(?:to|do i|can i)\s+(?:get|reach|find|go)\s+(?:to\s+)?(.+?)(?:\s*[?!]|\s+please|\s*$)/i,
        // "take me to X"
        /\btake\s+me\s+to\s+(.+?)(?:\s*[?!]|\s+please|\s*$)/i,
        // "where is X"
        /\bwhere\s+is\s+(.+?)(?:\s*[?!]|\s*$)/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m?.[1]) {
            // Strip trailing filler words and typo noise
            const name = m[1]
                .replace(/\s+(?:please|restaurant|cafe|café|bar|hotel|museum|place|site|throw the map|on the map|through the map)\s*$/i, '')
                .trim();
            if (name.length > 2) return name;
        }
    }
    return null;
}

// ─── Live-data field — caption above value, hairline below ───────────────────
const _fieldVariants = {
    hidden: { opacity: 0, y: 4 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.65, 0.2, 1] } },
};
const _fieldContainer = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

function LiveField({ label, value }) {
    if (!value) return null;
    return (
        <motion.div variants={_fieldVariants} className="py-1.5 border-b border-line-dark/40 last:border-0">
            <div className="t-caption" style={{ color: 'var(--color-ochre)', marginBottom: '3px' }}>
                — {label}
            </div>
            <div className="font-body italic text-[14px] leading-snug text-bone/90"
                 style={{ fontFamily: 'var(--font-body)' }}>
                {value}
            </div>
        </motion.div>
    );
}

function LiveData({ live }) {
    if (!live) return null;
    const fields = [];
    if (live.weather?.summary)      fields.push({ label: 'Weather',      value: live.weather.summary });
    if (live.air_quality?.summary)  fields.push({ label: 'Air',           value: live.air_quality.summary });
    if (live.prayer_times?.Fajr)    fields.push({ label: 'Prayer',        value: `Fajr ${live.prayer_times.Fajr} · Dhuhr ${live.prayer_times.Dhuhr} · Maghrib ${live.prayer_times.Maghrib}` });
    if (live.next_holiday)          fields.push({ label: 'Holiday',       value: `${live.next_holiday.name} — ${live.next_holiday.date}` });
    if (live.restaurants?.length)   fields.push({ label: 'Tables',        value: live.restaurants.slice(0, 2).map(r => r.name).join(' · ') });
    if (live.attractions?.length)   fields.push({ label: 'Plates',        value: live.attractions.slice(0, 2).map(a => a.name).join(' · ') });
    if (live.events?.length)        fields.push({ label: 'This week',     value: live.events.slice(0, 2).map(e => e.name).join(' · ') });
    if (live.news?.length)          fields.push({ label: 'News',          value: live.news[0].title });

    if (!fields.length) return null;
    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={_fieldContainer}
            className="mt-5 pt-4 border-t border-line-dark/60"
        >
            <div className="t-caption" style={{ color: 'oklch(0.78 0.012 70)', marginBottom: '8px' }}>
                — On the city, this hour
            </div>
            {fields.map((f, i) => <LiveField key={i} {...f} />)}
        </motion.div>
    );
}

export default function ChatContainer({ onAvatarState, autoTrigger, onLiveDataChange, onRouteRequest }) {
    // ── Core chat state ──
    const [input, setInput]         = useState('');
    const [messages, setMessages]   = useState([{
        id: 1, sender: 'ai',
        text: "Greetings, traveler! I am Ibn Battuta. How may I assist you in exploring the wonders of Tangier today?"
    }]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview]   = useState(null);

    // ── Location — defaults to Tangier (static development mode) ──
    const [coords, setCoords]               = useState({ latitude: 35.7595, longitude: -5.8340 });
    const [locationStatus, setLocationStatus] = useState('granted');
    const [currentCity, setCurrentCity]     = useState('Tangier');

    // ── STT ──
    const [isListening, setIsListening]     = useState(false);
    const [sttSupported]                    = useState(!!SpeechRecognition);

    // ── TTS ──
    const [isSpeaking, setIsSpeaking]       = useState(false);
    const [ttsEnabled, setTtsEnabled]       = useState(true);
    const [mouthEnergy, setMouthEnergy]     = useState(0);

    // ── Refs ──
    const fileInputRef    = useRef(null);
    const messagesEndRef  = useRef(null);
    const recognitionRef  = useRef(null);
    const autoSendRef     = useRef(false);
    const ttsQueueRef     = useRef([]);      // sentences waiting to be spoken
    const ttsActiveRef    = useRef(false);   // true while audio is playing
    const currentAudioRef = useRef(null);    // current HTMLAudioElement
    const energyTimerRef  = useRef(null);    // RAF id for analyser loop
    const audioCtxRef     = useRef(null);    // shared AudioContext (reused)
    const analyserRef     = useRef(null);    // AnalyserNode
    const analyserBufRef  = useRef(null);    // Uint8Array frequency buffer

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages]);

    // Lift avatar state to parent layout — throttled to 20 Hz to avoid cascade re-renders
    const lastAvatarUpdateRef = useRef(0);
    useEffect(() => {
        const now = Date.now();
        if (now - lastAvatarUpdateRef.current < 50) return;
        lastAvatarUpdateRef.current = now;
        onAvatarState?.({ energy: mouthEnergy, speaking: isSpeaking });
    }, [mouthEnergy, isSpeaking, onAvatarState]);

    // ════════════════════════════════════════════════════════════════
    // TTS — Microsoft Edge neural voices via backend /api/v1/tts
    // ════════════════════════════════════════════════════════════════

    const stopSpeech = useCallback(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }
        ttsQueueRef.current = [];
        ttsActiveRef.current = false;
        cancelAnimationFrame(energyTimerRef.current);
        setIsSpeaking(false);
        setMouthEnergy(0);
    }, []);

    const _playNextSentence = useCallback(async () => {
        if (!ttsQueueRef.current.length) {
            ttsActiveRef.current = false;
            setIsSpeaking(false);
            clearInterval(energyTimerRef.current);
            setMouthEnergy(0);
            return;
        }

        const sentence = ttsQueueRef.current.shift();
        ttsActiveRef.current = true;
        setIsSpeaking(true);

        try {
            const resp = await fetch('http://127.0.0.1:8000/api/v1/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: sentence, language: 'en' }),
            });
            if (!resp.ok) throw new Error(`TTS ${resp.status}`);

            const blob  = await resp.blob();
            const url   = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.crossOrigin = 'anonymous';
            currentAudioRef.current = audio;

            // ── Web Audio analysis for real lip-sync energy ──
            // Reuse a single AudioContext across sentences
            if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
                audioCtxRef.current = new AudioContext();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') await ctx.resume();

            const analyser = ctx.createAnalyser();
            analyser.fftSize             = 256;   // 128 frequency bins
            analyser.smoothingTimeConstant = 0.5;
            analyserRef.current  = analyser;
            analyserBufRef.current = new Uint8Array(analyser.frequencyBinCount);

            const source = ctx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(ctx.destination);

            // RAF loop: compute RMS over speech-frequency bins (≈80–3 kHz)
            const tick = () => {
                analyser.getByteFrequencyData(analyserBufRef.current);
                // Bins 1-20 cover ~86–1720 Hz (voice fundamentals + harmonics)
                const slice = analyserBufRef.current.slice(1, 21);
                const rms = Math.sqrt(slice.reduce((s, v) => s + v * v, 0) / slice.length);
                setMouthEnergy(Math.min(1, rms / 70));
                energyTimerRef.current = requestAnimationFrame(tick);
            };
            energyTimerRef.current = requestAnimationFrame(tick);

            const cleanup = () => {
                URL.revokeObjectURL(url);
                cancelAnimationFrame(energyTimerRef.current);
                setMouthEnergy(0);
                currentAudioRef.current = null;
            };

            audio.onended = () => { cleanup(); _playNextSentence(); };
            audio.onerror = () => { cleanup(); _playNextSentence(); };

            await audio.play();
        } catch (err) {
            console.error('TTS error:', err);
            clearInterval(energyTimerRef.current);
            setMouthEnergy(0);
            ttsActiveRef.current = false;
            setIsSpeaking(false);
        }
    }, []);

    // Queue a sentence for speech. Starts playback if nothing is playing.
    const speakSentence = useCallback((sentence) => {
        if (!ttsEnabled || !sentence.trim()) return;
        ttsQueueRef.current.push(sentence.trim());
        if (!ttsActiveRef.current) _playNextSentence();
    }, [ttsEnabled, _playNextSentence]);

    // ════════════════════════════════════════════════════════════════
    // IMAGE HANDLING
    // ════════════════════════════════════════════════════════════════
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('Image size must be less than 5MB'); return; }
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            const orig = event.target?.result;
            const img  = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 500, maxH = 350;
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; } }
                else        { if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                setImagePreview(canvas.toDataURL('image/jpeg', 0.70));
            };
            img.onerror = () => setImagePreview(orig);
            img.src = orig;
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Location is hardcoded to Tangier in development mode (see useState above).
    // GPS request was removed from the UI; re-add a button + handler if/when
    // multi-city mode returns.

    // ════════════════════════════════════════════════════════════════
    // STT — microphone → transcript → auto-send (speech-to-speech)
    // ════════════════════════════════════════════════════════════════
    const handleMicClick = useCallback(() => {
        if (!sttSupported) return;
        if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }

        const recognition = new SpeechRecognition();
        recognition.lang           = 'en-US';
        recognition.interimResults = true;
        recognition.continuous     = false;

        recognition.onresult = (e) => {
            let transcript = '';
            for (let i = e.resultIndex; i < e.results.length; i++)
                transcript += e.results[i][0].transcript;
            setInput(transcript);
            if (e.results[e.results.length - 1].isFinal) autoSendRef.current = true;
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend   = () => {
            setIsListening(false);
            if (autoSendRef.current) {
                autoSendRef.current = false;
                setTimeout(() => document.getElementById('chat-send-btn')?.click(), 150);
            }
        };

        recognitionRef.current = recognition;
        autoSendRef.current    = false;
        recognition.start();
        setIsListening(true);
    }, [isListening, sttSupported]);

    // ════════════════════════════════════════════════════════════════
    // SEND — SSE streaming from /chat/stream
    // ════════════════════════════════════════════════════════════════
    // SEND — accepts an optional overrideMsg for map auto-trigger
    // ════════════════════════════════════════════════════════════════
    const handleSend = async (overrideMsg = null) => {
        const messageText = overrideMsg ?? input;
        const imageToSend = overrideMsg ? null : imagePreview;

        if ((!messageText.trim() && !imageToSend) || isLoading) return;

        // Fire map routing before the API call — no delay for the user
        if (!overrideMsg && onRouteRequest && isRouteIntent(messageText)) {
            const dest = extractRouteDestination(messageText);
            if (dest) onRouteRequest(dest);
        }

        stopSpeech();

        const userMsg = { id: Date.now(), sender: 'user', text: messageText, image: imageToSend };
        setMessages(prev => [...prev, userMsg]);
        if (!overrideMsg) { setInput(''); removeImage(); }
        setIsLoading(true);

        // Placeholder AI message (will fill in real-time)
        const aiId = Date.now() + 1;
        setMessages(prev => [...prev, { id: aiId, sender: 'ai', text: '', city: null, live: null }]);

        try {
            const requestBody = {
                message: messageText || 'What can you see in this image?',
                city:    currentCity || 'Tangier',
            };
            if (imageToSend) requestBody.image_data = imageToSend;
            if (coords) { requestBody.latitude = coords.latitude; requestBody.longitude = coords.longitude; }

            const response = await fetch('http://127.0.0.1:8000/api/v1/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) throw new Error(`Backend error: ${response.status}`);

            const reader  = response.body.getReader();
            const decoder = new TextDecoder();
            let   buffer  = '';          // SSE line buffer
            let   fullText = '';         // accumulated AI text
            let   ttsBuffer = '';        // unsaid text waiting for sentence boundary

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete last line

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;
                    const raw = line.slice(5).trim();
                    if (!raw || raw === '[DONE]') continue;

                    let evt;
                    try { evt = JSON.parse(raw); } catch { continue; }

                    if (evt.type === 'meta') {
                        if (evt.city) setCurrentCity(evt.city);
                        if (evt.live) onLiveDataChange?.(evt.live);
                        setMessages(prev => prev.map(m =>
                            m.id === aiId ? { ...m, city: evt.city || null, live: evt.live || null } : m
                        ));
                    }

                    else if (evt.type === 'chunk') {
                        fullText  += evt.text;
                        ttsBuffer += evt.text;
                        // Update message bubble in real-time
                        setMessages(prev => prev.map(m =>
                            m.id === aiId ? { ...m, text: fullText } : m
                        ));
                        // Speak complete sentences as they arrive
                        const { done: sentence, rest } = extractCompleteSentences(ttsBuffer);
                        if (sentence) { speakSentence(sentence); ttsBuffer = rest; }
                    }

                    else if (evt.type === 'done') {
                        // Speak any remaining text
                        if (ttsBuffer.trim()) speakSentence(ttsBuffer.trim());
                        ttsBuffer = '';
                    }

                    else if (evt.type === 'error') {
                        setMessages(prev => prev.map(m =>
                            m.id === aiId ? { ...m, text: `❌ ${evt.message}` } : m
                        ));
                    }
                }
            }
        } catch (error) {
            const errText = error.message.includes('Failed to fetch')
                ? '❌ Cannot connect to backend. Is http://127.0.0.1:8000 running?'
                : `❌ ${error.message}`;
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: errText } : m));
        } finally {
            setIsLoading(false);
        }
    };

    // Always-fresh ref so the autoTrigger effect never sees a stale closure
    const handleSendRef = useRef(null);
    useEffect(() => { handleSendRef.current = handleSend; });

    // ── Auto-trigger: fires when a map landmark is clicked OR an itinerary seed arrives ──
    useEffect(() => {
        if (!autoTrigger) return;

        // Form 1: raw prompt (from /itineraries seed)
        if (autoTrigger.prompt) {
            handleSendRef.current?.(autoTrigger.prompt);
            return;
        }

        // Form 2a: GPS proximity — user physically arrived at a stop
        if (autoTrigger.landmark && autoTrigger.proximity) {
            const lm = autoTrigger.landmark;
            const msg =
                `I have just arrived at ${lm.name}${lm.sub ? ` — ${lm.sub}` : ''}. ` +
                `Speak to me as if we are standing here together right now. ` +
                `What do I see, hear, smell? What happened here? ` +
                `Be present-tense, vivid, and brief — two or three sentences, no more.`;
            handleSendRef.current?.(msg);
            return;
        }

        // Form 2b: landmark + nearby (from map legend click — full guide)
        if (autoTrigger.landmark) {
            const lm = autoTrigger.landmark;
            const nearbyNames = (autoTrigger.nearby || [])
                .map(n => n.name ?? n)
                .filter(Boolean);
            const nearbyStr = nearbyNames.length
                ? ` Along the route from Grand Socco we will pass near: ${nearbyNames.join(', ')}.`
                : '';
            const msg =
                `Take me to ${lm.name}${lm.sub ? ` — ${lm.sub}` : ''}. ` +
                `As Ibn Battuta, tell me everything fascinating about this place: its history, ` +
                `what to see, the people, the culture, and the hidden wonders it holds.` +
                `${nearbyStr} Guide me as a fellow traveler on this journey.`;
            handleSendRef.current?.(msg);
        }
    }, [autoTrigger]);

    // ════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════
    return (
        <div className="relative flex flex-col h-full on-ink">

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="px-8 pt-2 pb-6 flex-shrink-0 flex items-end justify-between gap-6">
                <div>
                    <div className="t-caption" style={{ color: 'oklch(0.75 0.01 70)' }}>
                        — In conversation with
                    </div>
                    <div
                        className="text-bone mt-1.5 leading-none"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   '34px',
                            letterSpacing: '-0.012em',
                        }}
                    >
                        Ibn Battuta
                    </div>
                    <div className="mt-2 flex items-baseline gap-3">
                        <span className="t-arabic" style={{ fontSize: '15px', color: 'oklch(0.78 0.012 70)' }}>ابن بطوطة</span>
                        <span className="t-caption">b. 1304 — 1369</span>
                    </div>
                </div>

                <button
                    onClick={() => { setTtsEnabled(v => !v); if (isSpeaking) stopSpeech(); }}
                    className="t-caption flex items-center gap-2 hover:text-bone transition-colors duration-300"
                    style={{ color: 'oklch(0.75 0.01 70)' }}
                    title={ttsEnabled ? 'Mute voice' : 'Unmute voice'}
                >
                    {isSpeaking
                        ? <span className="text-ochre">●</span>
                        : <span style={{ color: 'oklch(0.55 0.01 70)' }}>○</span>
                    }
                    <span>{ttsEnabled ? (isSpeaking ? 'Speaking' : 'Voice on') : 'Muted'}</span>
                </button>
            </header>

            {/* Hairline divider under header */}
            <div className="mx-8 h-px bg-line-dark opacity-50 flex-shrink-0" />

            {/* ── Messages ──────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-8 py-7 space-y-9">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                        const isUser = msg.sender === 'user';
                        const isStreaming = msg.sender === 'ai' && isLoading && msg.text === messages[messages.length - 1]?.text;
                        const stamp = msg._stamp || (msg._stamp = fmtTime(new Date(msg.id)));
                        return (
                            <motion.div
                                key={msg.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
                                className={isUser ? 'flex justify-end' : 'flex justify-start'}
                            >
                                {isUser ? (
                                    <div className="max-w-[72%]">
                                        <div className="t-caption text-right mb-2"
                                             style={{ color: 'oklch(0.65 0.01 70)' }}>
                                            — You · <span className="tabular">{stamp}</span>
                                        </div>
                                        {msg.image && (
                                            <img src={msg.image} alt="shared"
                                                 className="mb-2 max-h-56 w-auto ml-auto border border-line-dark" />
                                        )}
                                        {msg.text && (
                                            <p
                                                className="text-bone whitespace-pre-wrap text-right"
                                                style={{
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize:   '17px',
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                {msg.text}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="max-w-[80%]">
                                        <div className="t-caption mb-2.5" style={{ color: 'var(--color-ochre)' }}>
                                            — Ibn Battuta · <span className="tabular">{stamp}</span>
                                        </div>

                                        {msg.image && (
                                            <img src={msg.image} alt="shared"
                                                 className="mb-3 max-h-56 w-auto border border-line-dark" />
                                        )}

                                        {(msg.text || msg.sender === 'ai') && (
                                            <p
                                                className="text-bone whitespace-pre-wrap"
                                                style={{
                                                    fontFamily: 'var(--font-body)',
                                                    fontStyle:  'italic',
                                                    fontSize:   '18px',
                                                    lineHeight: 1.5,
                                                }}
                                            >
                                                {msg.text || (idx === messages.length - 1 && isLoading ? '' : '')}
                                                {isStreaming && (
                                                    <span className="inline-block w-[2px] h-[18px] bg-ochre ml-1 animate-pulse align-middle" />
                                                )}
                                            </p>
                                        )}

                                        {/* Live data — first AI message only or whenever attached */}
                                        {msg.live && <LiveData live={msg.live} />}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Typing indicator (slide 08) */}
                {isLoading && messages[messages.length - 1]?.sender === 'ai' && !messages[messages.length - 1]?.text && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        className="max-w-[80%]"
                    >
                        <div className="t-caption mb-2.5" style={{ color: 'var(--color-ochre)' }}>
                            — Ibn Battuta
                        </div>
                        <span
                            className="text-bone/60"
                            style={{
                                fontFamily: 'var(--font-body)',
                                fontStyle:  'italic',
                                fontSize:   '20px',
                                letterSpacing: '0.4em',
                            }}
                        >
                            . . .
                        </span>
                    </motion.div>
                )}

                {/* Listening — small ochre dot under the conversation, not a banner */}
                {isListening && (
                    <div className="flex justify-center pt-2">
                        <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                            className="t-caption flex items-center gap-2"
                            style={{ color: 'var(--color-ochre)' }}
                        >
                            <span>●</span>
                            <span>Listening</span>
                        </motion.span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Composer (slide 08 — ⁂ glyph + italic input + ↵ Speak) ── */}
            <div className="px-8 pt-4 pb-7 flex-shrink-0">

                {/* Image preview row */}
                {imagePreview && (
                    <div className="mb-4 flex items-center gap-3 pb-3 border-b border-line-dark/40">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-14 w-14 object-cover border border-line-dark"
                        />
                        <span className="t-small italic flex-1"
                              style={{ color: 'oklch(0.78 0.012 70)' }}>
                            Image attached.
                        </span>
                        <button
                            onClick={removeImage}
                            className="t-caption hover:text-bone transition-colors"
                            style={{ color: 'oklch(0.65 0.01 70)' }}
                        >
                            — Remove
                        </button>
                    </div>
                )}

                {/* Top hairline above the composer */}
                <div className="h-px bg-line-dark opacity-50 mb-4" />

                <div className="flex items-baseline gap-5">
                    {/* Ochre asterism — also acts as the Send affordance */}
                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && !selectedImage)}
                        className="text-ochre hover:text-ochre-deep transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontStyle:  'italic',
                            fontWeight: 300,
                            fontSize:   '32px',
                            lineHeight: 1,
                        }}
                        aria-label="Send"
                    >
                        {isLoading ? <Loader2 size={22} className="animate-spin inline-block" /> : <Ornament />}
                    </button>

                    {/* Italic input */}
                    <input
                        id="chat-send-btn"
                        type="text"
                        className="flex-1 bg-transparent border-0 outline-none text-bone placeholder:text-bone/35"
                        style={{
                            fontFamily: 'var(--font-body)',
                            fontStyle:  'italic',
                            fontSize:   '18px',
                            lineHeight: 1.5,
                        }}
                        placeholder={
                            isListening    ? 'Listening…'
                          : selectedImage  ? 'Describe the image, or simply send…'
                          : 'Ask, or simply listen…'
                        }
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                    />

                    {/* Right-side mono actions (deck slide 08: "↵ Speak") */}
                    <div className="flex items-baseline gap-5 flex-shrink-0">
                        {sttSupported && (
                            <button
                                onClick={handleMicClick}
                                disabled={isLoading}
                                className="t-caption hover:text-bone transition-colors duration-300"
                                style={{
                                    color: isListening ? 'var(--color-ochre)' : 'oklch(0.7 0.01 70)',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {isListening ? '● Listening' : '↵ Speak'}
                            </button>
                        )}

                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="t-caption hover:text-bone transition-colors duration-300"
                            style={{ color: 'oklch(0.7 0.01 70)' }}
                        >
                            ⌘ Image
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
