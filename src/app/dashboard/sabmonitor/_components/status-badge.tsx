'use client';

import * as React from 'react';

import { Badge, cn, type BadgeTone } from '@/components/sabcrm/20ui';

export type MonitorStatus =
    | 'up'
    | 'down'
    | 'warning'
    | 'unknown'
    | 'ongoing'
    | 'resolved'
    | 'active'
    | 'paused'
    | 'live';

/**
 * Compact colored pill for a check / run / incident status. Built on the 20ui
 * Badge so tone, dot, and motion all come from the design system. Color is
 * paired with a leading dot and an aria-label so status meaning never relies on
 * color alone.
 */
const STATUS_TONE: Record<MonitorStatus, BadgeTone> = {
    up: 'success',
    resolved: 'success',
    active: 'success',
    live: 'success',
    warning: 'warning',
    down: 'danger',
    ongoing: 'danger',
    paused: 'neutral',
    unknown: 'neutral',
};

export function StatusBadge({
    status,
    className,
}: {
    status: MonitorStatus;
    className?: string;
}): React.JSX.Element {
    return (
        <Badge
            tone={STATUS_TONE[status]}
            kind="soft"
            dot
            aria-label={`Status: ${status}`}
            className={cn('uppercase tracking-wide', className)}
        >
            {status}
        </Badge>
    );
}
