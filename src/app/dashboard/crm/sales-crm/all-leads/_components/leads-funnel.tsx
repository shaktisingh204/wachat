'use client';

import { Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
/**
 * <LeadsFunnel> — compact 5-segment horizontal bar that visualises the
 * conversion funnel (New → Contacted → Qualified → Proposal → Won).
 *
 * Each segment is clickable and emits its status via `onSelect` so the
 * parent can apply it as a status filter on the leads list.
 *
 * Counts come from a parent-supplied map; missing keys render as zero
 * but are kept visible to preserve funnel topology.
 */

import * as React from 'react';

import { statusToTone, type StatusTone } from '@/components/crm/status-pill';

export interface LeadsFunnelStage {
    /** Status string used by the filter. */
    key: string;
    /** Display label. */
    label: string;
    /** Numeric count of leads in this stage. */
    count: number;
}

export interface LeadsFunnelProps {
    stages: LeadsFunnelStage[];
    activeKey?: string;
    onSelect?: (stageKey: string) => void;
}

const TONE_BG: Record<StatusTone, string> = {
    neutral: 'bg-[var(--st-bg-muted)]',
    blue: 'bg-[var(--st-text-secondary)]/15',
    amber: 'bg-[var(--st-warn)]/15',
    green: 'bg-[var(--st-status-ok)]/15',
    red: 'bg-[var(--st-danger)]/15',
};

const TONE_BG_ACTIVE: Record<StatusTone, string> = {
    neutral: 'bg-[var(--st-border-strong)]',
    blue: 'bg-[var(--st-text-secondary)]/30 ring-1 ring-[var(--st-text-secondary)]',
    amber: 'bg-[var(--st-warn)]/30 ring-1 ring-[var(--st-warn)]',
    green: 'bg-[var(--st-status-ok)]/30 ring-1 ring-[var(--st-status-ok)]',
    red: 'bg-[var(--st-danger)]/30 ring-1 ring-[var(--st-danger)]',
};

export function LeadsFunnel({ stages, activeKey, onSelect }: LeadsFunnelProps) {
    const total = Math.max(1, stages.reduce((sum, s) => sum + (s.count || 0), 0));
    return (
        <Card className="h-full">
            <ZoruCardContent className="flex h-full flex-col gap-2 pt-4">
                <div className="flex items-center justify-between">
                    <span className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Conversion funnel
                    </span>
                    <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {total.toLocaleString()} total
                    </span>
                </div>
                <div className="flex h-7 w-full overflow-hidden rounded-md border border-[var(--st-border)]">
                    {stages.map((stage) => {
                        const tone = statusToTone(stage.key);
                        const isActive = activeKey === stage.key;
                        const widthPct = (stage.count / total) * 100;
                        const flexBasis = Math.max(8, widthPct);
                        return (
                            <button
                                key={stage.key}
                                type="button"
                                onClick={() => onSelect?.(stage.key)}
                                style={{ flexBasis: `${flexBasis}%` }}
                                aria-label={`Filter by ${stage.label} (${stage.count})`}
                                className={[
                                    'group relative flex items-center justify-center border-r border-[var(--st-border)] transition-colors last:border-r-0',
                                    isActive ? TONE_BG_ACTIVE[tone] : TONE_BG[tone],
                                    'hover:opacity-90',
                                ].join(' ')}
                            >
                                <span className="text-[10.5px] font-medium text-[var(--st-text)] truncate px-1">
                                    {stage.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <ul className="flex justify-between text-[10.5px] text-[var(--st-text-secondary)]">
                    {stages.map((s) => (
                        <li key={`label-${s.key}`} className="truncate text-center">
                            {s.label}
                        </li>
                    ))}
                </ul>
            </ZoruCardContent>
        </Card>
    );
}

export default LeadsFunnel;
