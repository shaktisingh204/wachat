'use client';

import * as React from 'react';
import { Card } from '@/components/sabcrm/20ui/compat';

export function ResourceUtilizationOverlay({ rows }: { rows: any[] }) {
  // Aggregate tasks by owner to show utilization
  const byOwner = rows.reduce((acc, r) => {
    if (!r.ownerName) return acc;
    acc[r.ownerName] = (acc[r.ownerName] || 0) + (r.tasksCount || 0);
    return acc;
  }, {} as Record<string, number>);
  
  const entries = Object.entries(byOwner).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Card className="p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
        <div className="w-32 h-32 bg-[var(--st-text)] rounded-full blur-3xl"></div>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Resource Utilization</h2>
        <span className="text-[12px] text-[var(--st-text-secondary)]">Top assigned</span>
      </div>
      <div className="space-y-3 relative z-10">
        {entries.map(([owner, count]) => (
          <div key={owner} className="flex flex-col gap-1">
            <div className="flex justify-between text-[12px]">
              <span>{owner}</span>
              <span className="font-medium">{count} tasks</span>
            </div>
            <div className="w-full bg-[var(--st-bg-muted)] rounded-full h-1.5">
              <div
                className="bg-[var(--st-text)] h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (count / (entries[0]?.[1] || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
