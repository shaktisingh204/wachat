'use client';

import React, { useState } from 'react';
import { Card, Input, Label } from '@/components/zoruui';

export function SimulatePointsCalculator({
    pointsPerCurrencyUnit,
    redemptionRatio,
    tiers,
}: {
    pointsPerCurrencyUnit?: number | null;
    redemptionRatio?: number | null;
    tiers?: Array<{ name: string; threshold?: number | null; multiplier?: number | null }>;
}) {
    const [spent, setSpent] = useState<number | ''>('');
    const baseRate = pointsPerCurrencyUnit || 1;
    
    // Sort tiers by threshold ascending
    const sortedTiers = (tiers || [])
        .filter(t => typeof t.threshold === 'number' && t.threshold !== null)
        .sort((a, b) => (a.threshold || 0) - (b.threshold || 0));

    const points = (Number(spent) || 0) * baseRate;
    
    let activeTier = null;
    let nextTier = null;
    let activeMultiplier = 1;

    for (let i = 0; i < sortedTiers.length; i++) {
        if (points >= (sortedTiers[i].threshold || 0)) {
            activeTier = sortedTiers[i];
            activeMultiplier = sortedTiers[i].multiplier || 1;
            nextTier = sortedTiers[i + 1] || null;
        } else if (!activeTier) {
            nextTier = sortedTiers[i];
            break;
        }
    }

    const earnedPoints = (Number(spent) || 0) * baseRate * activeMultiplier;
    const redemptionValue = redemptionRatio ? earnedPoints / redemptionRatio : 0;

    return (
        <Card className="p-6">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                Simulate Points Calculator
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                    <Label>Amount Spent (₹)</Label>
                    <Input 
                        type="number" 
                        value={spent} 
                        onChange={(e) => setSpent(e.target.value ? Number(e.target.value) : '')} 
                        placeholder="e.g. 1000"
                        className="mt-2"
                    />
                    <p className="mt-2 text-xs text-zoru-ink-muted">
                        Simulate how many points a customer would earn based on their tier and base rate (₹1 = {baseRate} pts).
                    </p>
                </div>
                <div className="flex flex-col justify-center space-y-3 text-[13px] text-zoru-ink rounded-lg bg-zoru-surface p-4 border border-zoru-border">
                    <div className="flex justify-between">
                        <span className="text-zoru-ink-muted">Points Earned:</span>
                        <span className="font-semibold">{earnedPoints.toFixed(2)} pts</span>
                    </div>
                    {activeTier ? (
                        <div className="flex justify-between">
                            <span className="text-zoru-ink-muted">Active Tier:</span>
                            <span className="font-semibold">{activeTier.name} ({activeMultiplier}x)</span>
                        </div>
                    ) : (
                        <div className="flex justify-between">
                            <span className="text-zoru-ink-muted">Active Tier:</span>
                            <span className="font-semibold">Base (1x)</span>
                        </div>
                    )}
                    {nextTier && (
                        <div className="flex justify-between">
                            <span className="text-zoru-ink-muted">Next Tier ({nextTier.name}):</span>
                            <span>{Math.max(0, (nextTier.threshold || 0) - points).toFixed(0)} pts needed</span>
                        </div>
                    )}
                    {redemptionRatio ? (
                        <div className="flex justify-between border-t border-zoru-border pt-3 mt-1">
                            <span className="text-zoru-ink-muted">Redemption Value:</span>
                            <span className="font-semibold text-zoru-ink">₹{redemptionValue.toFixed(2)}</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}
