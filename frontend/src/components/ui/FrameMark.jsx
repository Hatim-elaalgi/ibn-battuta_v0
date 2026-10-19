import React from 'react';

/**
 * The persistent slide chrome from the deck:
 *   ● Tangier طنجة                                        I — The proposition
 *   ───────────────────────────────────────────────────────────────────────
 *
 * Drop into any plate (it positions absolutely against its parent).
 * The parent must be `position: relative`.
 */
export default function FrameMark({ section = '', label = '' }) {
    return (
        <>
            <div className="frame-mark">
                <div className="mark-l">
                    <span className="dot">●</span>
                    <span>Tangier</span>
                    <span className="arabic-mark">طنجة</span>
                </div>
                {(section || label) && (
                    <div>
                        {section && <span>{section}</span>}
                        {section && label && <span>{' — '}</span>}
                        {label && <span>{label}</span>}
                    </div>
                )}
            </div>
            <div className="frame-rule" />
        </>
    );
}
