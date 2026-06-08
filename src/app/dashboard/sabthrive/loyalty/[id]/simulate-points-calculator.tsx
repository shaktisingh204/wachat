'use client';

import * as React from 'react';
import { Calculator } from 'lucide-react';

import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Separator,
} from '@/components/sabcrm/20ui';

export function SimulatePointsCalculator({
  pointsPerCurrencyUnit,
  redemptionRatio,
  tiers,
}: {
  pointsPerCurrencyUnit?: number | null;
  redemptionRatio?: number | null;
  tiers?: Array<{ name: string; threshold?: number | null; multiplier?: number | null }>;
}): React.JSX.Element {
  const [spent, setSpent] = React.useState<number | ''>('');
  const baseRate = pointsPerCurrencyUnit || 1;

  const sortedTiers = (tiers || [])
    .filter((t) => typeof t.threshold === 'number' && t.threshold !== null)
    .sort((a, b) => (a.threshold || 0) - (b.threshold || 0));

  const points = (Number(spent) || 0) * baseRate;

  let activeTier: (typeof sortedTiers)[number] | null = null;
  let nextTier: (typeof sortedTiers)[number] | null = null;
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
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-[var(--st-space-2)]">
          <Calculator className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
          <CardTitle>Points calculator</CardTitle>
        </div>
        <CardDescription>
          Preview the points a customer earns at their tier and base rate.
        </CardDescription>
      </CardHeader>
      <CardBody className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2">
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Field label="Amount spent (₹)" help={`Base rate: ₹1 earns ${baseRate} pts.`}>
            <Input
              type="number"
              min={0}
              value={spent}
              onChange={(e) => setSpent(e.target.value ? Number(e.target.value) : '')}
              placeholder="1,000"
            />
          </Field>
        </div>
        <div className="flex flex-col justify-center gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-4)] text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--st-text-secondary)]">Points earned</span>
            <span className="font-semibold tabular-nums text-[var(--st-text)]">
              {earnedPoints.toFixed(2)} pts
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--st-text-secondary)]">Active tier</span>
            <span className="font-medium text-[var(--st-text)]">
              {activeTier ? `${activeTier.name} (${activeMultiplier}×)` : 'Base (1×)'}
            </span>
          </div>
          {nextTier ? (
            <div className="flex items-center justify-between">
              <span className="text-[var(--st-text-secondary)]">To {nextTier.name}</span>
              <span className="tabular-nums text-[var(--st-text)]">
                {Math.max(0, (nextTier.threshold || 0) - points).toFixed(0)} pts
              </span>
            </div>
          ) : null}
          {redemptionRatio ? (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-[var(--st-text-secondary)]">Redemption value</span>
                <span className="font-semibold tabular-nums text-[var(--st-accent)]">
                  ₹{redemptionValue.toFixed(2)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
