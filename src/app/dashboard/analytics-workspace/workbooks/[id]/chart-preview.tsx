'use client';

/**
 * Generic chart preview. Maps `BiChartRunResponse.rows` onto Ui20's
 * recharts wrappers for bar / line / pie. Table renders rows directly;
 * KPI renders the first measure as a big number. map / heatmap show a
 * raw-rows table with a TODO badge.
 */
import { Badge, Table, TBody, THead, CHART_PALETTE, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
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
          <THead>
            <tr>
              {keys.map((k) => (
                <th key={k} className="text-left">
                  {k}
                </th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.slice(0, 100).map((r, i) => (
              <tr key={i} className="border-t border-[var(--st-border)]">
                {keys.map((k) => (
                  <td key={k} className="py-1.5 text-sm">
                    {String((r as Record<string, unknown>)[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </TBody>
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
      <ChartContainer height={280}>
        <Recharts.PieChart>
          <Recharts.Pie
            data={rows}
            dataKey={measureKey}
            nameKey={dimKey}
            outerRadius={100}
          >
            {rows.map((_, i) => (
              <Recharts.Cell
                key={i}
                fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              />
            ))}
          </Recharts.Pie>
          <Recharts.Tooltip content={<ChartTooltip />} />
          <Recharts.Legend />
        </Recharts.PieChart>
      </ChartContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ChartContainer height={280}>
        <Recharts.LineChart data={rows}>
          <Recharts.CartesianGrid stroke="var(--st-border)" strokeDasharray="3 3" />
          <Recharts.XAxis dataKey={dimKey} />
          <Recharts.YAxis />
          <Recharts.Tooltip content={<ChartTooltip />} />
          <Recharts.Line
            type="monotone"
            dataKey={measureKey}
            stroke={CHART_PALETTE[0]}
            dot={false}
          />
        </Recharts.LineChart>
      </ChartContainer>
    );
  }

  // bar (default)
  return (
    <ChartContainer height={280}>
      <Recharts.BarChart data={rows}>
        <Recharts.CartesianGrid stroke="var(--st-border)" strokeDasharray="3 3" />
        <Recharts.XAxis dataKey={dimKey} />
        <Recharts.YAxis />
        <Recharts.Tooltip content={<ChartTooltip />} />
        <Recharts.Bar dataKey={measureKey} fill={CHART_PALETTE[0]} />
      </Recharts.BarChart>
    </ChartContainer>
  );
}
