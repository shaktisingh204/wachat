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
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Tier Logic Visualizer
            </h2>
            <div className="relative border-l-2 border-[var(--st-border)] ml-3 mt-6">
                <div className="mb-8 ml-6 relative">
                    <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] border-2 border-[var(--st-border)]" />
                    <h3 className="text-[13px] font-semibold text-[var(--st-text)]">Base Tier</h3>
                    <p className="text-xs text-[var(--st-text-secondary)] mt-1">Default entry level. 1x multiplier.</p>
                </div>
                {sortedTiers.map((tier, idx) => (
                    <div key={idx} className="mb-8 ml-6 relative">
                        <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-accent)] border-2 border-[var(--st-bg-secondary)]" />
                        <h3 className="text-[13px] font-semibold text-[var(--st-text)]">{tier.name}</h3>
                        <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                            Upgrade automatically at <span className="font-medium text-[var(--st-text)]">{tier.threshold} pts</span>.
                        </p>
                        <p className="text-xs text-[var(--st-text-secondary)]">
                            Earns <span className="font-medium text-[var(--st-text)]">{tier.multiplier}x</span> points.
                        </p>
                        {expiryDays ? (
                            <p className="text-[11px] text-[var(--st-text)] mt-1">
                                Points expire after {expiryDays} days, causing possible downgrade.
                            </p>
                        ) : null}
                    </div>
                ))}
            </div>
            <div className="mt-4 bg-[var(--st-bg-secondary)]/50 rounded-md p-4 text-xs text-[var(--st-text-secondary)]">
                <strong>How it works:</strong> As customers accumulate lifetime points, they automatically progress through these tiers. Tiers offer point multipliers, meaning subsequent purchases generate points faster.
                {expiryDays ? ` If points expire after ${expiryDays} days and the customer's active points balance falls below a tier threshold, they may be downgraded.` : ' Points do not expire, so tiers are permanently retained once reached.'}
            </div>
        </Card>
    );
}
