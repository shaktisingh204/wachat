import * as React from 'react';

import { cn } from '@/components/zoruui';

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
            ? 'bg-zoru-ink/15 text-zoru-ink border-zoru-line/30'
            : status === 'warning'
              ? 'bg-zoru-ink/15 text-zoru-ink border-zoru-line/30'
              : status === 'down' || status === 'ongoing'
                ? 'bg-zoru-ink/15 text-zoru-ink border-zoru-line/30'
                : 'bg-zoru-surface-muted text-zoru-ink-muted border-zoru-line';
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
