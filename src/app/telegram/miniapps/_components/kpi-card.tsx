'use client';

import { Card } from '@/components/sabcrm/20ui';

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] text-[var(--st-text)] leading-tight">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">{hint}</div>
      ) : null}
    </Card>
  );
}
