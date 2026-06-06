'use client';

import {
  ZORU_CHART_PALETTE,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import { LineChart } from 'lucide-react';
import type { EmailTimeseriesPoint } from '@/lib/rust-client/email-reports';

interface OpenClickChartProps {
  data: EmailTimeseriesPoint[];
  title?: string;
  description?: string;
}

const { CartesianGrid, Line, XAxis, YAxis, Tooltip } = ZoruChart as unknown as typeof import('recharts');
const RechartsLineChart = (ZoruChart as unknown as typeof import('recharts')).LineChart;

function formatTick(t: string): string {
  try {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  } catch {
    // fallthrough
  }
  return t;
}

export function OpenClickChart({
  data,
  title = 'Engagement over time',
  description = 'Daily opens and clicks',
}: OpenClickChartProps) {
  const points = data ?? [];
  const hasData = points.length > 0 && points.some((p) => (p.opened ?? 0) + (p.clicked ?? 0) > 0);

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2">
          <LineChart className="h-4 w-4" /> {title}
        </ZoruCardTitle>
        <ZoruCardDescription>{description}</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        {hasData ? (
          <ZoruChartContainer height={280}>
            <RechartsLineChart data={points} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--st-border)]" />
              <XAxis
                dataKey="t"
                tickFormatter={formatTick}
                tick={{ fill: 'var(--st-text-secondary)', fontSize: 11 }}
                stroke="var(--st-border)"
              />
              <YAxis
                tick={{ fill: 'var(--st-text-secondary)', fontSize: 11 }}
                stroke="var(--st-border)"
              />
              <Tooltip content={<ZoruChartTooltip />} />
              <Line
                type="monotone"
                dataKey="opened"
                name="Opened"
                stroke={ZORU_CHART_PALETTE[0]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="clicked"
                name="Clicked"
                stroke={ZORU_CHART_PALETTE[1]}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </RechartsLineChart>
          </ZoruChartContainer>
        ) : (
          <EmptyState
            icon={<LineChart />}
            title="No engagement yet"
            description="Once mail is sent, opens and clicks will appear here."
          />
        )}
      </ZoruCardContent>
    </Card>
  );
}
