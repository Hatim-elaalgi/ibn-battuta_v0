import React from 'react';
import { motion } from 'framer-motion';

/**
 * Plate — the deck's editorial surface primitive.
 * Square edges, hairline border, no shadow. Pass `tone="ink"` for dark surface.
 */
export default function Plate({
    tone = 'bone',          // 'bone' | 'bone-deep' | 'ink' | 'plaster'
    className = '',
    as = 'motion',
    children,
    ...rest
}) {
    const surface = {
        bone:        'bg-bone',
        'bone-deep': 'bg-bone-deep',
        ink:         'bg-ink on-ink',
        plaster:     'bg-plaster',
    }[tone] || 'bg-bone';

    const border = tone === 'ink' ? 'border-line-dark' : 'border-line-soft';

    const combined = `relative ${surface} border ${border} ${className}`.trim();

    if (as === 'div') return <div className={combined} {...rest}>{children}</div>;
    return (
        <motion.div
            className={combined}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1] }}
            {...rest}
        >
            {children}
        </motion.div>
    );
}
