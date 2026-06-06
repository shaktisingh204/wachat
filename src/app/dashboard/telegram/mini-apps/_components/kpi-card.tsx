'use client';

import { Card } from '@/components/sabcrm/20ui/compat';

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
      <div className="text-[11px] uppercase tracking-wider text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] text-zoru-ink leading-tight">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</div>
      ) : null}
    </Card>
  );
}
