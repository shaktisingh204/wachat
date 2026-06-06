'use client';

import * as React from 'react';
import { Activity } from 'lucide-react';

import { EmptyState } from '@/components/sabcrm/20ui';

/**
 * Minimal inline SVG response-time chart. Deliberately framework-free so
 * we don't introduce a new chart dependency for what is essentially a
 * 200-pixel sparkline. Colours source from 20ui status tokens.
 */
export function ResponseTimeChart({
    points,
}: {
    points: Array<{ ts: string; ms: number; status: 'up' | 'down' | 'warning' }>;
}): React.JSX.Element {
    if (points.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={Activity}
                title="No data points yet"
                description="Response time samples will plot here once monitoring runs."
            />
        );
    }
    const w = 800;
    const h = 160;
    const padding = 8;
    const maxMs = Math.max(...points.map((p) => p.ms), 1);
    const stepX = (w - padding * 2) / Math.max(points.length - 1, 1);
    const toY = (ms: number): number => h - padding - (ms / maxMs) * (h - padding * 2);

    const path = points
        .map((p, i) => {
            const x = padding + i * stepX;
            const y = toY(p.ms);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-40 w-full text-[var(--st-text-secondary)]"
            role="img"
            aria-label="Response time chart"
        >
            <rect x={0} y={0} width={w} height={h} fill="transparent" />
            <path d={path} stroke="currentColor" strokeWidth={1.5} fill="none" />
            {points.map((p, i) => {
                const cx = padding + i * stepX;
                const cy = toY(p.ms);
                // Status drives the dot colour at runtime; source from 20ui tokens.
                const fill =
                    p.status === 'up'
                        ? 'var(--st-status-ok)'
                        : p.status === 'warning'
                          ? 'var(--st-warn)'
                          : 'var(--st-danger)';
                return <circle key={i} cx={cx} cy={cy} r={2.5} fill={fill} />;
            })}
        </svg>
    );
}
