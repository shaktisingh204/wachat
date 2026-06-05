'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/sabcrm/20ui';
import {
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  } from 'date-fns';
import { DateRange } from 'react-day-picker';

/**
 * TransactionChart (wachat-local, 20ui).
 *
 * Replaces the legacy whatsapp-pay/transaction-chart.
 * Same data shape (transactions + dateRange), same memoised grouping.
 * Visual swap: Recharts via the 20ui Chart family, on-system --st-* tokens.
 */

import * as React from 'react';
import * as Recharts from 'recharts';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const CHART_CONFIG: ChartConfig = {
  revenue: { label: 'Revenue', color: 'var(--st-accent)' },
};

interface TransactionChartProps {
  transactions: any[];
  dateRange: DateRange | undefined;
}

export function TransactionChart({
  transactions,
  dateRange,
}: TransactionChartProps) {
  const chartData = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const filtered = transactions.filter((t) => {
      const date = new Date(t.createdAt);
      return isWithinInterval(date, {
        start: startOfDay(dateRange.from!),
        end: endOfDay(dateRange.to!),
      });
    });

    const grouped = filtered.reduce(
      (acc, t) => {
        const dateStr = format(new Date(t.createdAt), 'yyyy-MM-dd');
        if (!acc[dateStr]) {
          acc[dateStr] = { date: dateStr, revenue: 0, count: 0 };
        }
        if (t.status === 'SUCCESS') {
          acc[dateStr].revenue += t.amount / 100;
          acc[dateStr].count += 1;
        }
        return acc;
      },
      {} as Record<string, { date: string; revenue: number; count: number }>,
    );

    return Object.values(grouped).sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [transactions, dateRange]);

  if (chartData.length === 0) {
    return (
      <div
        className={cx(
          'flex h-[300px] w-full items-center justify-center text-[13px]',
        )}
        style={{ color: 'var(--st-text-secondary)' }}
      >
        No data available for the selected period
      </div>
    );
  }

  return (
    <ChartContainer config={CHART_CONFIG} style={{ height: 300 }}>
      <Recharts.AreaChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="st20RevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Recharts.CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--st-border)"
        />
        <Recharts.XAxis
          dataKey="date"
          tickFormatter={(str) => format(parseISO(str), 'MMM d')}
          tick={{ fontSize: 12, fill: 'var(--st-text-tertiary)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--st-border)' }}
        />
        <Recharts.YAxis
          tick={{ fontSize: 12, fill: 'var(--st-text-tertiary)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: any) => `₹${value}`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) =>
                label ? format(parseISO(String(label)), 'PPP') : ''
              }
              formatter={(value, _name, item) => (
                <>
                  <span
                    aria-hidden="true"
                    className="u-chart-tt__indicator u-chart-tt__indicator--dot"
                    style={
                      {
                        '--u-chart-indicator':
                          item?.color ?? 'var(--color-revenue)',
                      } as React.CSSProperties
                    }
                  />
                  <div className="u-chart-tt__content">
                    <div className="u-chart-tt__name-wrap">
                      <span className="u-chart-tt__name">Revenue</span>
                    </div>
                    <span className="u-chart-tt__value">{`₹${value}`}</span>
                  </div>
                </>
              )}
            />
          }
        />
        <Recharts.Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--color-revenue)"
          fill="url(#st20RevenueFill)"
          fillOpacity={1}
        />
      </Recharts.AreaChart>
    </ChartContainer>
  );
}
