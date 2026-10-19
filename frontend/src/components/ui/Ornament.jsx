import React from 'react';

/**
 * The deck's editorial ornament — the "⁂" asterism in ochre.
 * Used as a section divider, the composer's send glyph, and a quiet bullet.
 */
export default function Ornament({ className = '' }) {
    return (
        <span
            className={className}
            aria-hidden
            style={{
                fontFamily: 'var(--font-display)',
                fontStyle:  'italic',
                fontWeight: 300,
                letterSpacing: '0.02em',
                lineHeight: 1,
            }}
        >
            ⁂
        </span>
    );
}
