'use client';

/**
 * Small status-dot overlay for an avatar. Colour mirrors Slack's
 * convention: green = online, amber = away, red = dnd, grey = offline.
 *
 * 20ui has no dedicated presence primitive, so this is a low-level dot built
 * on a structural span. Size, colour, and ring are runtime-computed from props,
 * which is the genuinely-computed exception for inline style; the palette and
 * ring default use 20ui `--st-*` tokens.
 */
import * as React from 'react';

import type { PresenceStatus } from '../../../../actions/team-chat.actions.types';

const COLOR: Record<PresenceStatus, string> = {
    online: 'var(--st-status-ok)',
    away: 'var(--st-warn)',
    dnd: 'var(--st-danger)',
    offline: 'var(--st-text-tertiary)',
};

const LABEL: Record<PresenceStatus, string> = {
    online: 'Online',
    away: 'Away',
    dnd: 'Do not disturb',
    offline: 'Offline',
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
    ringColor = 'var(--st-bg)',
}: PresenceDotProps) {
    return (
        <span
            role="img"
            aria-label={`Presence: ${LABEL[status]}`}
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
