'use client';

/**
 * Small status-dot overlay for an avatar. Colour mirrors Slack's
 * convention: green = online, amber = away, red = dnd, grey = offline.
 */
import * as React from 'react';

import type { PresenceStatus } from '../../../../actions/team-chat.actions.types';

const COLOR: Record<PresenceStatus, string> = {
    online: 'var(--st-status-ok)',
    away: 'var(--st-warn)',
    dnd: 'var(--st-danger)',
    offline: 'var(--st-text-tertiary)',
};

export interface PresenceDotProps {
    status?: PresenceStatus;
    size?: number;
    /** Render with a ring colour matching the host background. */
    ringColor?: string;
}

export function PresenceDot({
    status = 'offline',
    size = 8,
    ringColor = 'var(--zoru-bg, #fff)',
}: PresenceDotProps) {
    return (
        <span
            aria-label={`Presence: ${status}`}
            className="inline-block rounded-full"
            style={{
                width: size,
                height: size,
                background: COLOR[status],
                boxShadow: `0 0 0 1.5px ${ringColor}`,
            }}
        />
    );
}
