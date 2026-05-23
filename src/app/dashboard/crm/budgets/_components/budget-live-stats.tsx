'use client';

import * as React from 'react';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { useRealtimeBudget } from './use-realtime-budget';
import { BudgetProgressBar } from './budget-progress-bar';

function fmtPct(plan?: number, actual?: number): string {
  if (typeof plan !== 'number' || plan === 0) return '—';
  const used = ((actual ?? 0) / plan) * 100;
  return `${used.toFixed(1)}%`;
}

function fmtMoney(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

interface BudgetLiveStatsProps {
  budgetId: string;
  planAmount: number;
  initialActual: number;
  alertAt: number;
}

export function BudgetLiveStats({ budgetId, planAmount, initialActual, alertAt }: BudgetLiveStatsProps) {
  const actual = useRealtimeBudget(budgetId, initialActual, planAmount, alertAt);
  const variance = planAmount - actual;
  const overrun = variance < 0;
  const variancePct = planAmount !== 0 ? ((variance / planAmount) * 100).toFixed(1) : '—';
  
  let utilisation = 0;
  if (planAmount !== 0) {
      utilisation = Math.min(100, Math.round((actual / planAmount) * 100));
  } else if (actual > 0) {
      utilisation = 100;
  }

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Variance (Live)</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <div className="space-y-2 text-[12.5px]">
          <div className="flex items-center justify-between">
            <span className="text-zoru-ink-muted">% of plan used</span>
            <span className="font-mono tabular-nums">
              {fmtPct(planAmount, actual)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zoru-ink-muted">Variance</span>
            <span
              className={`font-mono tabular-nums ${overrun ? 'text-zoru-danger-ink' : 'text-zoru-ink'}`}
            >
              {fmtMoney(variance)} ({variancePct}%)
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-zoru-line pt-2">
            <span className="text-zoru-ink-muted">Plan</span>
            <span className="font-mono tabular-nums">
              {fmtMoney(planAmount)}
            </span>
          </div>
          <BudgetProgressBar utilisation={utilisation} />
        </div>
      </ZoruCardContent>
    </Card>
  );
}
