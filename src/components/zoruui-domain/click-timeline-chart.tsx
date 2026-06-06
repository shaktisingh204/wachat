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
import { Card, Skeleton, cn } from '@/components/sabcrm/20ui';
import { MousePointerClick } from 'lucide-react';

interface ClickTimelineChartProps {
  data: { date: string; count: number }[];
  isLoading?: boolean;
  onGranularityChange?: (days: number) => void;
}

const GRANULARITIES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

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
    <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12px] shadow-lg">
      <p className="text-[var(--st-text-secondary)] mb-0.5">{label ? formatAxisDate(label) : ''}</p>
      <p className="text-[var(--st-text)] font-medium">{payload[0].value} clicks</p>
    </div>
  );
}

export function ClickTimelineChart({ data, isLoading, onGranularityChange }: ClickTimelineChartProps) {
  const [activeGranularity, setActiveGranularity] = useState<7 | 30 | 90>(30);

  const handleGranularity = (days: 7 | 30 | 90) => {
    setActiveGranularity(days);
    onGranularityChange?.(days);
  };

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <span className="text-[13px] text-[var(--st-text)]">Click Activity</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--st-border)] p-0.5 bg-[var(--st-bg-muted)]">
          {GRANULARITIES.map(({ label, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => handleGranularity(days as 7 | 30 | 90)}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] transition-colors',
                activeGranularity === days
                  ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm'
                  : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
          No click data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--zoru-line, #27272a)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
              tickFormatter={formatAxisDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#clickGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
