'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  EmptyState,
  Progress,
} from '@/components/sabcrm/20ui';

export function ResourceUtilizationOverlay({ rows }: { rows: any[] }) {
  // Aggregate tasks by owner to show utilization
  const byOwner = rows.reduce((acc, r) => {
    if (!r.ownerName) return acc;
    acc[r.ownerName] = (acc[r.ownerName] || 0) + (r.tasksCount || 0);
    return acc;
  }, {} as Record<string, number>);

  const entries = Object.entries(byOwner)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const peak = entries[0]?.[1] || 1;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Resource Utilization</CardTitle>
        <Badge tone="neutral" kind="soft">
          Top assigned
        </Badge>
      </CardHeader>
      <CardBody>
        {entries.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No assigned work yet"
            description="Assign tasks to owners to see how the team's workload is distributed."
            size="sm"
          />
        ) : (
          <div className="space-y-3">
            {entries.map(([owner, count]) => (
              <div key={owner} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--st-text)]">{owner}</span>
                  <span className="font-medium text-[var(--st-text-secondary)]">
                    {count} tasks
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (count / peak) * 100)}
                  size="sm"
                  aria-label={`${owner}: ${count} tasks`}
                />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
