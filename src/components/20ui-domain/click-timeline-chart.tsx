'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, Skeleton, SegmentedControl, EmptyState } from '@/components/sabcrm/20ui';
import { MousePointerClick } from 'lucide-react';

interface ClickTimelineChartProps {
  data: { date: string; count: number }[];
  isLoading?: boolean;
  onGranularityChange?: (days: number) => void;
}

type GranularityValue = '7' | '30' | '90';

const GRANULARITIES: ReadonlyArray<{ value: GranularityValue; label: string }> = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
];

function formatAxisDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayloadItem {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12px] shadow-lg">
      <p className="text-[var(--st-text-secondary)] mb-0.5">{label ? formatAxisDate(label) : ''}</p>
      <p className="text-[var(--st-text)] font-medium">{payload[0].value} clicks</p>
    </div>
  );
}

export function ClickTimelineChart({ data, isLoading, onGranularityChange }: ClickTimelineChartProps) {
  const [activeGranularity, setActiveGranularity] = useState<GranularityValue>('30');

  const handleGranularity = (value: GranularityValue) => {
    setActiveGranularity(value);
    onGranularityChange?.(Number(value));
  };

  if (isLoading) {
    return (
      <Card padding="lg">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-[var(--st-radius)]" />
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="text-[13px] text-[var(--st-text)]">Click Activity</span>
        </div>
        <SegmentedControl
          size="sm"
          aria-label="Time range"
          items={GRANULARITIES}
          value={activeGranularity}
          onChange={handleGranularity}
        />
      </div>

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center">
          <EmptyState
            size="sm"
            icon={MousePointerClick}
            title="No click data yet"
            description="Clicks will appear here once your links start getting traffic."
          />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--st-accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--st-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
              tickFormatter={formatAxisDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--st-accent)', strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--st-accent)"
              strokeWidth={2}
              fill="url(#clickGradient)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--st-accent)', stroke: 'var(--st-bg)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
