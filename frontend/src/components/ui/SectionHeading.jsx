import React from 'react';

/**
 * Editorial section heading: small, uppercase, gold-toned letterspacing.
 * Defaults to display serif weight and ink/70 color — override via className.
 */
export default function SectionHeading({ children, className = '', as: Tag = 'h3' }) {
    return (
        <Tag
            className={
                'font-display text-[13px] uppercase tracking-[0.18em] text-ink/70 ' +
                'flex items-center gap-2 ' +
                className
            }
        >
            {children}
        </Tag>
    );
}
