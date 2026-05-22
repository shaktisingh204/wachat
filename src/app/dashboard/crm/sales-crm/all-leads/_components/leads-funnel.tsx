'use client';

import { Card, ZoruCardContent } from '@/components/zoruui';
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
    neutral: 'bg-zoru-surface-2',
    blue: 'bg-zoru-info/15',
    amber: 'bg-zoru-warn/15',
    green: 'bg-zoru-success/15',
    red: 'bg-zoru-danger/15',
};

const TONE_BG_ACTIVE: Record<StatusTone, string> = {
    neutral: 'bg-zoru-line-strong',
    blue: 'bg-zoru-info/30 ring-1 ring-zoru-info',
    amber: 'bg-zoru-warn/30 ring-1 ring-zoru-warn',
    green: 'bg-zoru-success/30 ring-1 ring-zoru-success',
    red: 'bg-zoru-danger/30 ring-1 ring-zoru-danger',
};

export function LeadsFunnel({ stages, activeKey, onSelect }: LeadsFunnelProps) {
    const total = Math.max(1, stages.reduce((sum, s) => sum + (s.count || 0), 0));
    return (
        <ZoruCard className="h-full">
            <ZoruCardContent className="flex h-full flex-col gap-2 pt-4">
                <div className="flex items-center justify-between">
                    <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Conversion funnel
                    </span>
                    <span className="text-[11.5px] text-zoru-ink-muted">
                        {total.toLocaleString()} total
                    </span>
                </div>
                <div className="flex h-7 w-full overflow-hidden rounded-md border border-zoru-line">
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
                                    'group relative flex items-center justify-center border-r border-zoru-line transition-colors last:border-r-0',
                                    isActive ? TONE_BG_ACTIVE[tone] : TONE_BG[tone],
                                    'hover:opacity-90',
                                ].join(' ')}
                            >
                                <span className="text-[10.5px] font-medium text-zoru-ink truncate px-1">
                                    {stage.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <ul className="flex justify-between text-[10.5px] text-zoru-ink-muted">
                    {stages.map((s) => (
                        <li key={`label-${s.key}`} className="truncate text-center">
                            {s.label}
                        </li>
                    ))}
                </ul>
            </ZoruCardContent>
        </ZoruCard>
    );
}

export default LeadsFunnel;
