import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NAV = [
    { to: '/create',       label: 'Plan →',      accent: true },
    { to: '/walk',         label: 'Walk' },
    { to: '/itineraries',  label: 'Itineraries' },
    { to: '/field-guide',  label: 'Field guide' },
    { to: '/live',         label: 'Live now' },
    { to: '/about',        label: 'About' },
];

export default function AppShell() {
    const location = useLocation();

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-bone text-ink flex flex-col">

            {/* ── Persistent wordmark + nav strip ─────────────────────── */}
            <header className="flex-shrink-0 z-30">
                <div className="flex items-baseline justify-between px-7 pt-4 pb-3">
                    <NavLink
                        to="/"
                        className="flex items-baseline gap-3 text-[10px] uppercase tracking-[0.22em] font-mono text-ink-mute hover:text-ink transition-colors"
                    >
                        <span className="text-ochre">●</span>
                        <span>Tangier</span>
                        <span
                            className="text-[13px] tracking-normal normal-case text-ink/80"
                            style={{ fontFamily: 'var(--font-arabic)' }}
                        >
                            طنجة
                        </span>
                    </NavLink>

                    <nav className="hidden md:flex items-baseline gap-7">
                        {NAV.map(({ to, label, accent }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    accent
                                        ? `relative text-[13px] tracking-[0.02em] transition-colors duration-300 ${
                                              isActive ? 'text-ochre' : 'text-ochre/70 hover:text-ochre'
                                          }`
                                        : `relative text-[13px] tracking-[0.02em] transition-colors duration-300 ${
                                              isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                                          }`
                                }
                                style={{ fontFamily: 'var(--font-body)', fontStyle: accent ? 'italic' : undefined }}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && !accent && (
                                            <motion.span
                                                layoutId="nav-active-dot"
                                                className="absolute -left-3 top-1.5 text-[8px] text-ochre"
                                                transition={{ duration: 0.5, ease: [0.2, 0.65, 0.2, 1] }}
                                            >
                                                ●
                                            </motion.span>
                                        )}
                                        {label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.22em] font-mono text-ink-mute">
                        <span className="text-ink">EN</span>
                        <span>·</span>
                        <span
                            className="text-[14px] tracking-normal normal-case"
                            style={{ fontFamily: 'var(--font-arabic)' }}
                        >
                            ع
                        </span>
                    </div>
                </div>
                <div className="mx-7 h-px bg-line opacity-70" />
            </header>

            {/* ── Page outlet with cross-fade transition ─────────────── */}
            <main className="flex-1 min-h-0 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.2, 0.65, 0.2, 1] }}
                        className="absolute inset-0"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
