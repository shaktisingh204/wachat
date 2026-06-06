'use client';

import * as React from 'react';
import { Card, CardBody, Skeleton } from '@/components/sabcrm/20ui';
import { ClipboardList, Clock, CheckCircle2, CalendarDays } from 'lucide-react';

export interface KpiItem {
  label: string;
  value: number;
  hint?: string;
}

interface ReportsKpiStripProps {
  kpisPromise: Promise<KpiItem[]>;
}

const KPI_ICONS = [
  <ClipboardList key="0" className="h-4 w-4 text-[var(--st-text-secondary)]" />,
  <Clock key="1" className="h-4 w-4 text-[var(--st-text)]" />,
  <CheckCircle2 key="2" className="h-4 w-4 text-[var(--st-text)]" />,
  <CalendarDays key="3" className="h-4 w-4 text-[var(--st-text-secondary)]" />,
];

export function ReportsKpiStrip({ kpisPromise }: ReportsKpiStripProps) {
  const kpis = React.use(kpisPromise);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map((kpi, i) => (
        <Card key={kpi.label} variant="soft">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                {kpi.label}
              </span>
              {KPI_ICONS[i]}
            </div>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                i === 1 && kpi.value > 0
                  ? 'text-[var(--st-text)]'
                  : 'text-[var(--st-text)]'
              }`}
            >
              {kpi.value}
            </p>
            {kpi.hint ? (
              <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">{kpi.hint}</p>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export function ReportsKpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} variant="soft">
          <CardBody className="p-4">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-7 w-12" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
