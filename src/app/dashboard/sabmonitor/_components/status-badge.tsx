import * as React from 'react';

import { cn } from '@/components/sabcrm/20ui';

/**
 * Compact colored pill for a check / run / incident status. Uses the
 * existing ZoruUI palette tokens — no bespoke colors.
 */
export function StatusBadge({
    status,
    className,
}: {
    status: 'up' | 'down' | 'warning' | 'unknown' | 'ongoing' | 'resolved' | 'active' | 'paused' | 'live';
    className?: string;
}): React.JSX.Element {
    const tone =
        status === 'up' || status === 'resolved' || status === 'active' || status === 'live'
            ? 'bg-[var(--st-text)]/15 text-[var(--st-text)] border-[var(--st-border)]/30'
            : status === 'warning'
              ? 'bg-[var(--st-text)]/15 text-[var(--st-text)] border-[var(--st-border)]/30'
              : status === 'down' || status === 'ongoing'
                ? 'bg-[var(--st-text)]/15 text-[var(--st-text)] border-[var(--st-border)]/30'
                : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] border-[var(--st-border)]';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                tone,
                className,
            )}
        >
            {status}
        </span>
    );
}
