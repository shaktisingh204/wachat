'use client';

import * as React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/zoruui';
import {
  getProjectBurndown,
  type BurndownMode,
  type BurndownSeries,
} from '@/app/actions/worksuite/projects.actions';

export interface BurndownChartProps {
  projectId: string;
}

interface ChartRow {
  date: string;
  ideal: number | null;
  actual: number | null;
}

function mergeSeries(series: BurndownSeries): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const p of series.ideal) {
    map.set(p.date, { date: p.date, ideal: p.value, actual: null });
  }
  for (const p of series.actual) {
    const existing = map.get(p.date);
    if (existing) {
      existing.actual = p.value;
    } else {
      map.set(p.date, { date: p.date, ideal: null, actual: p.value });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatTick(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
}

export function BurndownChart({ projectId }: BurndownChartProps) {
  const [mode, setMode] = React.useState<BurndownMode>('tasks');
  const [series, setSeries] = React.useState<BurndownSeries | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const reload = React.useCallback(
    (m: BurndownMode) => {
      startTransition(() => {
        void getProjectBurndown(projectId, m).then((s) => setSeries(s));
      });
    },
    [projectId],
  );

  React.useEffect(() => {
    reload(mode);
  }, [reload, mode]);

  const rows = React.useMemo<ChartRow[]>(
    () => (series ? mergeSeries(series) : []),
    [series],
  );

  const hasData = rows.length > 0;
  const unit = mode === 'tasks' ? 'tasks' : 'hours';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
            <BarChart3
              className="h-4 w-4 text-zoru-ink"
              strokeWidth={1.75}
            />
          </div>
          <div>
            <p className="text-[14px] font-medium text-zoru-ink">
              Burndown Chart
            </p>
            <p className="text-[11.5px] text-zoru-ink-muted">
              Ideal vs actual remaining {unit} from start to deadline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1">
            <button
              type="button"
              onClick={() => setMode('tasks')}
              className={`rounded-[var(--zoru-radius-sm)] px-3 py-1 text-[12px] transition-colors ${
                mode === 'tasks'
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink'
              }`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setMode('hours')}
              className={`rounded-[var(--zoru-radius-sm)] px-3 py-1 text-[12px] transition-colors ${
                mode === 'hours'
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink'
              }`}
            >
              Hours
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reload(mode)}
            disabled={isPending}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            Refresh
          </Button>
        </div>
      </div>

      {isPending && !series ? (
        <Skeleton className="h-72 w-full" />
      ) : !hasData ? (
        <div className="rounded-lg border border-dashed border-zoru-line p-12 text-center">
          <p className="text-[13px] text-zoru-ink-muted">
            This project has no start date / deadline, or no tasks yet — no
            burndown data to plot.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="ghost">
              Total: {series?.total ?? 0} {unit}
            </Badge>
            <Badge variant="ghost">
              {rows.length} day{rows.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--zoru-line, #e5e7eb)"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTick}
                  fontSize={11}
                  stroke="var(--zoru-ink-muted, #6b7280)"
                />
                <YAxis
                  fontSize={11}
                  stroke="var(--zoru-ink-muted, #6b7280)"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--zoru-bg, #fff)',
                    border: '1px solid var(--zoru-line, #e5e7eb)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--zoru-ink, #111)' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name="Ideal"
                  stroke="#9ca3af"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
