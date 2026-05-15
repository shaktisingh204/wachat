'use client';

/**
 * ChartHourlySendPattern — bar chart of outbound message count per hour,
 * with annotation bands for "safe" (under 60/h), "elevated" (60-100/h),
 * and "risky" (100+/h) — anti-ban tuning aid.
 */

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock } from 'lucide-react';

import type { SabwaAnalyticsHourBar } from '@/app/actions/sabwa.actions';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

const SAFE_LIMIT = 60;
const ELEVATED_LIMIT = 100;

function barColor(count: number): string {
  if (count <= SAFE_LIMIT) return '#10b981'; // green
  if (count <= ELEVATED_LIMIT) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

export interface ChartHourlySendPatternProps {
  data: SabwaAnalyticsHourBar[];
}

export function ChartHourlySendPattern({ data }: ChartHourlySendPatternProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No send pattern yet"
        description="Once you send messages, you'll see your hourly velocity here with safe and elevated bands."
      />
    );
  }

  // Build 24-bucket bars to always cover 0..23, filling gaps with 0.
  const filled = Array.from({ length: 24 }, (_, hour) => {
    const found = data.find((d) => d.hour === hour);
    return { hour, count: found?.count ?? 0 };
  });
  const maxCount = Math.max(...filled.map((d) => d.count), ELEVATED_LIMIT + 10);

  return (
    <div className="space-y-2">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filled}
            margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="hour"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                fontSize: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--popover))',
              }}
              formatter={(value) => [`${value} msgs`, 'Sent'] as [string, string]}
              labelFormatter={(label) => `Hour ${label}`}
            />
            <ReferenceArea
              y1={0}
              y2={SAFE_LIMIT}
              fill="#10b981"
              fillOpacity={0.05}
            />
            <ReferenceArea
              y1={SAFE_LIMIT}
              y2={ELEVATED_LIMIT}
              fill="#f59e0b"
              fillOpacity={0.08}
            />
            <ReferenceArea
              y1={ELEVATED_LIMIT}
              y2={maxCount}
              fill="#ef4444"
              fillOpacity={0.08}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {filled.map((entry, idx) => (
                <Cell key={idx} fill={barColor(entry.count)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" />
          Safe (&le; {SAFE_LIMIT}/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-amber-500" />
          Elevated ({SAFE_LIMIT + 1}–{ELEVATED_LIMIT}/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-red-500" />
          Risky (&gt; {ELEVATED_LIMIT}/h)
        </span>
      </div>
    </div>
  );
}
