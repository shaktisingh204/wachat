'use client';

import * as React from 'react';
import { GanttChartSquare } from 'lucide-react';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Badge,
  EmptyState,
} from '@/components/sabcrm/20ui';

export function GanttChartPreview({ rows }: { rows: any[] }) {
  const preview = rows.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gantt Chart Previews</CardTitle>
        <CardDescription>Timeline view of active projects</CardDescription>
      </CardHeader>
      <CardBody>
        {preview.length === 0 ? (
          <EmptyState
            icon={GanttChartSquare}
            title="No active projects"
            description="Projects appear here once they have a schedule to plot on the timeline."
          />
        ) : (
          <div className="space-y-4">
            {preview.map((r, i) => {
              // Derive a preview bar offset/length from the row index.
              const startPct = Math.min(80, i * 15);
              const widthPct = Math.max(10, 80 - startPct);
              const left = 25 + startPct * 0.75;
              const width = widthPct * 0.75;
              const tone =
                r.completionPercent >= 100
                  ? 'success'
                  : r.completionPercent >= 50
                    ? 'accent'
                    : 'neutral';
              return (
                <div
                  key={r._id}
                  className="relative flex items-center h-8 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
                >
                  <div className="absolute left-2 z-10 w-1/4 truncate text-[12px] font-medium text-[var(--st-text)]">
                    {r.name}
                  </div>
                  <div
                    className="absolute h-full flex items-center px-2 rounded-[var(--st-radius)] border border-[var(--st-accent)] bg-[var(--st-accent)]/15"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <Badge tone={tone} kind="solid">
                      {r.completionPercent}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
