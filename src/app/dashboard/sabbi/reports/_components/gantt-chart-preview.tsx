'use client';

import * as React from 'react';
import { Card } from '@/components/zoruui';

export function GanttChartPreview({ rows }: { rows: any[] }) {
  // Mock gantt timeline based on rows
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-zoru-ink">Gantt Chart Previews</h2>
        <p className="text-[13px] text-zoru-ink-muted">Timeline view of active projects</p>
      </div>
      <div className="space-y-4">
        {rows.slice(0, 5).map((r, i) => {
          // Generate a pseudo-random bar based on index for preview
          const startPct = Math.min(80, i * 15);
          const widthPct = Math.max(10, 80 - startPct);
          return (
            <div key={r._id} className="relative flex items-center h-8 bg-zoru-surface-2/30 rounded-md">
              <div className="absolute left-2 w-1/4 truncate text-[12px] font-medium z-10">{r.name}</div>
              <div
                className="absolute h-full bg-zoru-ink/20 rounded-md border border-primary/40 flex items-center px-2"
                style={{ left: `${25 + startPct * 0.75}%`, width: `${widthPct * 0.75}%` }}
              >
                <span className="text-[10px] text-zoru-ink font-medium">{r.completionPercent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
