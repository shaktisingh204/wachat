'use client';

/**
 * TransactionChart (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/whatsapp-pay/transaction-chart.
 * Same data shape (transactions + dateRange), same memoised grouping.
 * Visual swap: Recharts via ZoruChart family with greyscale palette.
 */

import * as React from 'react';
import {
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns';
import { DateRange } from 'react-day-picker';

import {
  ZORU_CHART_PALETTE,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
} from '@/components/zoruui';

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
      <div className="flex h-[300px] w-full items-center justify-center text-[13px] text-zoru-ink-muted">
        No data available for the selected period
      </div>
    );
  }

  const stroke = ZORU_CHART_PALETTE[0];

  return (
    <ZoruChartContainer height={300}>
      <ZoruChart.AreaChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="zoruRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.4} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ZoruChart.CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--zoru-line))"
        />
        <ZoruChart.XAxis
          dataKey="date"
          tickFormatter={(str) => format(parseISO(str), 'MMM d')}
          stroke="hsl(var(--zoru-ink-muted))"
          fontSize={12}
        />
        <ZoruChart.YAxis
          stroke="hsl(var(--zoru-ink-muted))"
          fontSize={12}
          tickFormatter={(value: any) => `₹${value}`}
        />
        <ZoruChart.Tooltip
          content={(props: any) => (
            <ZoruChartTooltip
              {...props}
              label={
                props?.label
                  ? format(parseISO(String(props.label)), 'PPP')
                  : undefined
              }
              payload={(props?.payload || []).map((p: any) => ({
                ...p,
                name: 'Revenue',
                value: `₹${p.value}`,
                color: stroke,
              }))}
            />
          )}
        />
        <ZoruChart.Area
          type="monotone"
          dataKey="revenue"
          stroke={stroke}
          fill="url(#zoruRevenueFill)"
          fillOpacity={1}
        />
      </ZoruChart.AreaChart>
    </ZoruChartContainer>
  );
}
