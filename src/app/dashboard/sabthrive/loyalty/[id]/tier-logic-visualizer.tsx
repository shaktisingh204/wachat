'use client';

import React from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';

export function TierLogicVisualizer({
    tiers,
    expiryDays
}: {
    tiers?: Array<{ name: string; threshold?: number | null; multiplier?: number | null }>;
    expiryDays?: number | null;
}) {
    const sortedTiers = (tiers || [])
        .filter(t => typeof t.threshold === 'number' && t.threshold !== null)
        .sort((a, b) => (a.threshold || 0) - (b.threshold || 0));

    if (sortedTiers.length === 0) {
        return null;
    }

    return (
        <Card className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Tier Logic Visualizer
            </h2>
            <div className="relative border-l-2 border-zoru-border ml-3 mt-6">
                <div className="mb-8 ml-6 relative">
                    <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zoru-surface border-2 border-zoru-border" />
                    <h3 className="text-[13px] font-semibold text-zoru-ink">Base Tier</h3>
                    <p className="text-xs text-zoru-ink-muted mt-1">Default entry level. 1x multiplier.</p>
                </div>
                {sortedTiers.map((tier, idx) => (
                    <div key={idx} className="mb-8 ml-6 relative">
                        <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zoru-brand border-2 border-zoru-surface" />
                        <h3 className="text-[13px] font-semibold text-zoru-ink">{tier.name}</h3>
                        <p className="text-xs text-zoru-ink-muted mt-1">
                            Upgrade automatically at <span className="font-medium text-zoru-ink">{tier.threshold} pts</span>.
                        </p>
                        <p className="text-xs text-zoru-ink-muted">
                            Earns <span className="font-medium text-zoru-ink">{tier.multiplier}x</span> points.
                        </p>
                        {expiryDays ? (
                            <p className="text-[11px] text-zoru-ink mt-1">
                                Points expire after {expiryDays} days, causing possible downgrade.
                            </p>
                        ) : null}
                    </div>
                ))}
            </div>
            <div className="mt-4 bg-zoru-surface/50 rounded-md p-4 text-xs text-zoru-ink-muted">
                <strong>How it works:</strong> As customers accumulate lifetime points, they automatically progress through these tiers. Tiers offer point multipliers, meaning subsequent purchases generate points faster.
                {expiryDays ? ` If points expire after ${expiryDays} days and the customer's active points balance falls below a tier threshold, they may be downgraded.` : ' Points do not expire, so tiers are permanently retained once reached.'}
            </div>
        </Card>
    );
}
