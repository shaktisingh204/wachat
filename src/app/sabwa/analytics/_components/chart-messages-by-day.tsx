'use client';

import { CHART_PALETTE, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import {
  MessageSquare } from 'lucide-react';

import type { SabwaAnalyticsSeriesPoint } from '@/app/actions/sabwa.actions.types';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

/**
 * ChartMessagesByDay — line chart showing inbound vs outbound messages by day.
 * Falls back to <EmptyState> when there is no data. Built on Recharts with
 * the greyscale CHART_PALETTE.
 */

import * as React from 'react';

export interface ChartMessagesByDayProps {
  data: SabwaAnalyticsSeriesPoint[];
}

export function ChartMessagesByDay({ data }: ChartMessagesByDayProps) {
  if (!data.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description="Inbound and outbound volume will appear here once your session starts moving traffic."
      />
    );
  }
  return (
    <ChartContainer height={288}>
      <Recharts.LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
      >
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          className="stroke-[var(--st-border)]"
        />
        <Recharts.XAxis
          dataKey="date"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Recharts.YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Recharts.Tooltip content={<ChartTooltip />} />
        <Recharts.Legend wrapperStyle={{ fontSize: 12 }} />
        <Recharts.Line
          type="monotone"
          dataKey="in"
          stroke={CHART_PALETTE[0]}
          strokeWidth={2}
          dot={false}
          name="Inbound"
        />
        <Recharts.Line
          type="monotone"
          dataKey="out"
          stroke={CHART_PALETTE[1]}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          name="Outbound"
        />
      </Recharts.LineChart>
    </ChartContainer>
  );
}
