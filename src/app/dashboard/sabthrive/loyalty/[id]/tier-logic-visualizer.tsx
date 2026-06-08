'use client';

import * as React from 'react';
import { Layers } from 'lucide-react';

import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui';

export function TierLogicVisualizer({
  tiers,
  expiryDays,
}: {
  tiers?: Array<{ name: string; threshold?: number | null; multiplier?: number | null }>;
  expiryDays?: number | null;
}): React.JSX.Element {
  const sortedTiers = (tiers || [])
    .filter((t) => typeof t.threshold === 'number' && t.threshold !== null)
    .sort((a, b) => (a.threshold || 0) - (b.threshold || 0));

  const steps = [
    { name: 'Base tier', threshold: 0, multiplier: 1, base: true },
    ...sortedTiers.map((t) => ({
      name: t.name,
      threshold: t.threshold || 0,
      multiplier: t.multiplier || 1,
      base: false,
    })),
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-[var(--st-space-2)]">
          <Layers className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
          <CardTitle>Tier ladder</CardTitle>
        </div>
        <CardDescription>
          How customers progress as their lifetime points grow.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {sortedTiers.length === 0 ? (
          <Callout tone="info" title="No tiers configured">
            Add tiers to this program to give customers a path to higher earning
            multipliers.
          </Callout>
        ) : (
          <>
            <ol className="relative ml-1.5 flex flex-col gap-[var(--st-space-4)] border-l border-[var(--st-border)] pl-[var(--st-space-4)]">
              {steps.map((step, idx) => (
                <li key={idx} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[calc(var(--st-space-4)+5px)] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--st-bg-secondary)] ${
                      step.base ? 'bg-[var(--st-border-strong,var(--st-text-secondary))]' : 'bg-[var(--st-accent)]'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-[var(--st-text)]">
                      {step.name}
                    </span>
                    <Badge tone={step.base ? 'neutral' : 'accent'} kind="soft">
                      {step.multiplier}× points
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                    {step.base
                      ? 'Default entry level for every member.'
                      : `Unlocks automatically at ${step.threshold.toLocaleString()} points.`}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-[var(--st-space-4)] text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
              {expiryDays
                ? `Points expire after ${expiryDays} days. If a member's balance drops below a threshold, they may move down a tier.`
                : 'Points never expire, so members keep every tier they reach.'}
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
