'use client';

/**
 * Generic chart preview. Maps `BiChartRunResponse.rows` onto ZoruUI's
 * recharts wrappers for bar / line / pie. Table renders rows directly;
 * KPI renders the first measure as a big number. map / heatmap show a
 * raw-rows table with a TODO badge.
 */
import {
  Badge,
  Table,
  TableBody,
  TableHeader,
  ZORU_CHART_PALETTE,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
} from '@/components/sabcrm/20ui/compat';
import type { BiChartColumn, BiChartType } from '@/lib/rust-client/bi-charts';

interface Props {
  chartType: BiChartType;
  rows: Record<string, unknown>[];
  columns: BiChartColumn[];
}

export function ChartPreview({ chartType, rows, columns }: Props) {
  const dimKey = columns.find((c) => c.role === 'dimension')?.key;
  const measureKey = columns.find((c) => c.role === 'measure')?.key;

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--st-text-secondary)]">No rows returned.</p>;
  }

  if (chartType === 'kpi') {
    const total = rows.reduce(
      (acc, r) => acc + Number((r as Record<string, unknown>)[measureKey ?? ''] ?? 0),
      0,
    );
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
          {measureKey ?? 'value'}
        </span>
        <span className="text-3xl font-semibold text-[var(--st-text)]">{total}</span>
      </div>
    );
  }

  if (chartType === 'table' || chartType === 'map' || chartType === 'heatmap') {
    const keys = Object.keys(rows[0] ?? {});
    return (
      <div className="flex flex-col gap-2">
        {chartType !== 'table' && (
          <Badge variant="outline">
            {chartType} renderer pending — showing raw rows
          </Badge>
        )}
        <Table>
          <TableHeader>
            <tr>
              {keys.map((k) => (
                <th key={k} className="text-left">
                  {k}
                </th>
              ))}
            </tr>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((r, i) => (
              <tr key={i} className="border-t border-[var(--st-border)]">
                {keys.map((k) => (
                  <td key={k} className="py-1.5 text-sm">
                    {String((r as Record<string, unknown>)[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!dimKey || !measureKey) {
    return (
      <p className="text-sm text-[var(--st-text-secondary)]">
        Need at least one dimension and one measure to render this chart.
      </p>
    );
  }

  if (chartType === 'pie') {
    return (
      <ZoruChartContainer height={280}>
        <ZoruChart.PieChart>
          <ZoruChart.Pie
            data={rows}
            dataKey={measureKey}
            nameKey={dimKey}
            outerRadius={100}
          >
            {rows.map((_, i) => (
              <ZoruChart.Cell
                key={i}
                fill={ZORU_CHART_PALETTE[i % ZORU_CHART_PALETTE.length]}
              />
            ))}
          </ZoruChart.Pie>
          <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
          <ZoruChart.Legend />
        </ZoruChart.PieChart>
      </ZoruChartContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ZoruChartContainer height={280}>
        <ZoruChart.LineChart data={rows}>
          <ZoruChart.CartesianGrid stroke="var(--st-border)" strokeDasharray="3 3" />
          <ZoruChart.XAxis dataKey={dimKey} />
          <ZoruChart.YAxis />
          <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
          <ZoruChart.Line
            type="monotone"
            dataKey={measureKey}
            stroke={ZORU_CHART_PALETTE[0]}
            dot={false}
          />
        </ZoruChart.LineChart>
      </ZoruChartContainer>
    );
  }

  // bar (default)
  return (
    <ZoruChartContainer height={280}>
      <ZoruChart.BarChart data={rows}>
        <ZoruChart.CartesianGrid stroke="var(--st-border)" strokeDasharray="3 3" />
        <ZoruChart.XAxis dataKey={dimKey} />
        <ZoruChart.YAxis />
        <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
        <ZoruChart.Bar dataKey={measureKey} fill={ZORU_CHART_PALETTE[0]} />
      </ZoruChart.BarChart>
    </ZoruChartContainer>
  );
}
