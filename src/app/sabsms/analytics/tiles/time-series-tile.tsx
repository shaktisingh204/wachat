"use client";

import Link from "next/link";

import { CHART_PALETTE, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';

import { TileActions } from "./tile-actions";
import type { SabsmsTimeSeriesPoint } from "../aggregations";

export interface TimeSeriesTileProps {
  data: SabsmsTimeSeriesPoint[];
  drilldownHref: string;
  queryString: string;
}

export function TimeSeriesTile({
  data,
  drilldownHref,
  queryString,
}: TimeSeriesTileProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Volume over time</CardTitle>
          <CardDescription>
            Sent / delivered / failed counts per day.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Open in logs
          </Link>
          <TileActions
            metric="time-series"
            tileId="time-series"
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--st-text-secondary)]">
            No traffic in this window.
          </p>
        ) : (
          <ChartContainer height={260}>
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
              <Recharts.YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Recharts.Tooltip content={<ChartTooltip />} />
              <Recharts.Legend wrapperStyle={{ fontSize: 12 }} />
              <Recharts.Line
                type="monotone"
                dataKey="sent"
                stroke={CHART_PALETTE[0]}
                strokeWidth={2}
                dot={false}
                name="Sent"
              />
              <Recharts.Line
                type="monotone"
                dataKey="delivered"
                stroke={CHART_PALETTE[1]}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                name="Delivered"
              />
              <Recharts.Line
                type="monotone"
                dataKey="failed"
                stroke={CHART_PALETTE[3]}
                strokeWidth={2}
                strokeDasharray="2 3"
                dot={false}
                name="Failed"
              />
            </Recharts.LineChart>
          </ChartContainer>
        )}
      </CardBody>
    </Card>
  );
}
