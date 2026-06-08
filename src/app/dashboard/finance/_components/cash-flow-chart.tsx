'use client';

import * as React from 'react';
import {
  Recharts,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  CHART_PALETTE,
  type ChartConfig,
} from '@/components/sabcrm/20ui';

/** Twelve-week cash-flow series — money in vs money out, in thousands of rupees. */
const SERIES = [
  { week: 'Mar 03', inflow: 312, outflow: 198 },
  { week: 'Mar 10', inflow: 286, outflow: 224 },
  { week: 'Mar 17', inflow: 341, outflow: 207 },
  { week: 'Mar 24', inflow: 298, outflow: 256 },
  { week: 'Mar 31', inflow: 372, outflow: 241 },
  { week: 'Apr 07', inflow: 329, outflow: 219 },
  { week: 'Apr 14', inflow: 405, outflow: 268 },
  { week: 'Apr 21', inflow: 388, outflow: 233 },
  { week: 'Apr 28', inflow: 421, outflow: 279 },
  { week: 'May 05', inflow: 396, outflow: 245 },
  { week: 'May 12', inflow: 452, outflow: 261 },
  { week: 'May 19', inflow: 478, outflow: 252 },
];

const CONFIG: ChartConfig = {
  inflow: { label: 'Money in', color: CHART_PALETTE[0] },
  outflow: { label: 'Money out', color: CHART_PALETTE[2] },
};

/**
 * CashFlowChart — a token-styled area chart of weekly inflow vs outflow.
 * Recharts needs the DOM, so this lives in a small client island.
 */
export function CashFlowChart(): React.JSX.Element {
  return (
    <ChartContainer config={CONFIG} className="h-[280px] w-full">
      <Recharts.AreaChart data={SERIES} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="cf-inflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PALETTE[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART_PALETTE[0]} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cf-outflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PALETTE[2]} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART_PALETTE[2]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Recharts.CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-[var(--st-border)]" />
        <Recharts.XAxis dataKey="week" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
        <Recharts.YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => `₹${v}k`}
        />
        <Recharts.Tooltip content={<ChartTooltipContent />} />
        <Recharts.Area
          type="monotone"
          dataKey="inflow"
          stroke={CHART_PALETTE[0]}
          strokeWidth={2}
          fill="url(#cf-inflow)"
        />
        <Recharts.Area
          type="monotone"
          dataKey="outflow"
          stroke={CHART_PALETTE[2]}
          strokeWidth={2}
          fill="url(#cf-outflow)"
        />
      </Recharts.AreaChart>
    </ChartContainer>
  );
}
