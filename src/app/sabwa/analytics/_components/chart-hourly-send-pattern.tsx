'use client';

import { ZORU_CHART_PALETTE, ZoruChart, ZoruChartContainer, ZoruChartTooltip } from '@/components/sabcrm/20ui/compat';
import {
  Clock } from 'lucide-react';

import type { SabwaAnalyticsHourBar } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartHourlySendPattern — bar chart of outbound message count per hour,
 * with annotation bands for "safe" (under 60/h), "elevated" (60-100/h),
 * and "risky" (100+/h) — anti-ban tuning aid.
 *
 * Bars use the neutral ZoruChart palette; risk tier is communicated by
 * fill density (not hue), to stay within the greyscale chart policy.
 */

import * as React from 'react';

const SAFE_LIMIT = 60;
const ELEVATED_LIMIT = 100;

function barColor(count: number): string {
  // Neutral tiers — darker = riskier — within ZORU_CHART_PALETTE.
  if (count <= SAFE_LIMIT) return ZORU_CHART_PALETTE[3];
  if (count <= ELEVATED_LIMIT) return ZORU_CHART_PALETTE[2];
  return ZORU_CHART_PALETTE[0];
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
  const maxCount = Math.max(
    ...filled.map((d) => d.count),
    ELEVATED_LIMIT + 10,
  );

  return (
    <div className="space-y-2">
      <ZoruChartContainer height={288}>
        <ZoruChart.BarChart
          data={filled}
          margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
        >
          <ZoruChart.CartesianGrid
            strokeDasharray="3 3"
            className="stroke-zoru-line"
          />
          <ZoruChart.XAxis
            dataKey="hour"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <ZoruChart.YAxis fontSize={11} tickLine={false} axisLine={false} />
          <ZoruChart.Tooltip
            content={<ZoruChartTooltip />}
            formatter={(value: unknown) =>
              [`${value} msgs`, 'Sent'] as [string, string]
            }
            labelFormatter={(label: unknown) => `Hour ${label}`}
          />
          <ZoruChart.ReferenceArea
            y1={0}
            y2={SAFE_LIMIT}
            fill={ZORU_CHART_PALETTE[4]}
            fillOpacity={0.4}
          />
          <ZoruChart.ReferenceArea
            y1={SAFE_LIMIT}
            y2={ELEVATED_LIMIT}
            fill={ZORU_CHART_PALETTE[3]}
            fillOpacity={0.3}
          />
          <ZoruChart.ReferenceArea
            y1={ELEVATED_LIMIT}
            y2={maxCount}
            fill={ZORU_CHART_PALETTE[2]}
            fillOpacity={0.25}
          />
          <ZoruChart.Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {filled.map((entry, idx) => (
              <ZoruChart.Cell key={idx} fill={barColor(entry.count)} />
            ))}
          </ZoruChart.Bar>
        </ZoruChart.BarChart>
      </ZoruChartContainer>
      <div className="flex flex-wrap items-center gap-3 px-2 text-[11px] text-zoru-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: ZORU_CHART_PALETTE[3] }}
          />
          Safe (&le; {SAFE_LIMIT}/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: ZORU_CHART_PALETTE[2] }}
          />
          Elevated ({SAFE_LIMIT + 1}–{ELEVATED_LIMIT}/h)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: ZORU_CHART_PALETTE[0] }}
          />
          Risky (&gt; {ELEVATED_LIMIT}/h)
        </span>
      </div>
    </div>
  );
}
