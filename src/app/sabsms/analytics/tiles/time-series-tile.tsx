"use client";

import Link from "next/link";

import {
  ZORU_CHART_PALETTE,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
} from "@/components/zoruui";

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
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Volume over time</ZoruCardTitle>
          <ZoruCardDescription>
            Sent / delivered / failed counts per day.
          </ZoruCardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-zoru-ink-muted hover:text-zoru-ink"
          >
            Open in logs
          </Link>
          <TileActions
            metric="time-series"
            tileId="time-series"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-zoru-ink-muted">
            No traffic in this window.
          </p>
        ) : (
          <ZoruChartContainer height={260}>
            <ZoruChart.LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
            >
              <ZoruChart.CartesianGrid
                strokeDasharray="3 3"
                className="stroke-zoru-line"
              />
              <ZoruChart.XAxis
                dataKey="date"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <ZoruChart.YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
              <ZoruChart.Legend wrapperStyle={{ fontSize: 12 }} />
              <ZoruChart.Line
                type="monotone"
                dataKey="sent"
                stroke={ZORU_CHART_PALETTE[0]}
                strokeWidth={2}
                dot={false}
                name="Sent"
              />
              <ZoruChart.Line
                type="monotone"
                dataKey="delivered"
                stroke={ZORU_CHART_PALETTE[1]}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                name="Delivered"
              />
              <ZoruChart.Line
                type="monotone"
                dataKey="failed"
                stroke={ZORU_CHART_PALETTE[3]}
                strokeWidth={2}
                strokeDasharray="2 3"
                dot={false}
                name="Failed"
              />
            </ZoruChart.LineChart>
          </ZoruChartContainer>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}
