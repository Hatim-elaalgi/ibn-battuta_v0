import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ChatContainer from '../chat/ChatContainer';
import AvatarViewer from '../avatar/AvatarViewer';
import TangierMap from '../map/TangierMap';

const slow = (delay = 0) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: [0.2, 0.65, 0.2, 1], delay },
});

export default function MainLayout() {
    const [mouthEnergy, setMouthEnergy] = useState(0);
    const [isSpeaking, setIsSpeaking]   = useState(false);
    const [autoTrigger, setAutoTrigger] = useState(null);

    const handleAvatarState = ({ energy, speaking }) => {
        setMouthEnergy(energy);
        setIsSpeaking(speaking);
    };

    const handleLandmarkSelect = useCallback((landmark, nearby) => {
        setAutoTrigger({ landmark, nearby, ts: Date.now() });
    }, []);

    return (
        <div className="relative flex h-screen w-screen overflow-hidden bg-bone text-ink">

            {/* ── Persistent top wordmark + nav strip (whole-page chrome) ── */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-baseline justify-between px-7 pt-4 pb-3 pointer-events-none">
                <div className="flex items-baseline gap-3 text-[10px] uppercase tracking-[0.22em] font-mono text-ink-mute">
                    <span className="text-ochre">●</span>
                    <span>Tangier</span>
                    <span className="font-arabic text-[13px] tracking-normal normal-case text-ink/80" style={{ fontFamily: 'var(--font-arabic)' }}>طنجة</span>
                </div>

                <nav className="hidden md:flex items-baseline gap-7 text-[12px] tracking-[0.04em] text-ink-soft" style={{ fontFamily: 'var(--font-body)' }}>
                    <span className="text-ink relative">
                        <span className="absolute -left-3 top-1.5 text-[8px] text-ochre">●</span>
                        Walk
                    </span>
                    <span className="opacity-60">Itineraries</span>
                    <span className="opacity-60">Field guide</span>
                    <span className="opacity-60">Live now</span>
                    <span className="opacity-60">About</span>
                </nav>

                <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.22em] font-mono text-ink-mute">
                    <span className="text-ink">EN</span>
                    <span>·</span>
                    <span className="text-[14px] tracking-normal normal-case" style={{ fontFamily: 'var(--font-arabic)' }}>ع</span>
                </div>
            </div>

            {/* Hairline below the wordmark strip */}
            <div className="absolute top-[52px] left-7 right-7 h-px bg-line opacity-70 z-20 pointer-events-none" />

            {/* ── Chat panel (left, dark surface) ─────────────────────── */}
            <motion.div
                {...slow(0)}
                className="relative w-full md:w-[44%] h-full bg-ink on-ink z-10 flex flex-col pt-14"
            >
                <ChatContainer
                    onAvatarState={handleAvatarState}
                    autoTrigger={autoTrigger}
                />
            </motion.div>

            {/* ── Right column (avatar + map, bone surface) ─────────── */}
            <div className="hidden md:flex md:w-[56%] h-full flex-col pt-14 bg-bone">

                {/* Avatar plate — top */}
                <motion.div {...slow(0.12)} className="h-[44%] flex-shrink-0 px-7 pt-3 pb-3">
                    <AvatarViewer energy={mouthEnergy} speaking={isSpeaking} />
                </motion.div>

                {/* Map plate — bottom */}
                <motion.div {...slow(0.22)} className="flex-1 min-h-0 px-7 pb-7">
                    <TangierMap onLandmarkSelect={handleLandmarkSelect} />
                </motion.div>

            </div>
        </div>
    );
}
