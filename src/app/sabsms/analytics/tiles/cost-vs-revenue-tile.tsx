"use client";

import Link from "next/link";

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
} from "@/components/zoruui";

import { TileActions } from "./tile-actions";
import type { SabsmsCostPoint } from "../aggregations";

export interface CostVsRevenueTileProps {
  data: SabsmsCostPoint[];
  drilldownHref: string;
  queryString: string;
  variant?: "lines" | "margin";
}

export function CostVsRevenueTile({
  data,
  drilldownHref,
  queryString,
  variant = "lines",
}: CostVsRevenueTileProps) {
  const tileId = variant === "margin" ? "margin" : "cost-vs-revenue";
  const title = variant === "margin" ? "Margin" : "Cost vs revenue";
  const description =
    variant === "margin"
      ? "Stacked bar of revenue (paid) over cost (wholesale)."
      : "Daily wholesale cost vs customer-facing revenue (USD cents).";

  return (
    <Card>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>{title}</ZoruCardTitle>
          <ZoruCardDescription>{description}</ZoruCardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-zoru-ink-muted hover:text-zoru-ink"
          >
            Open in logs
          </Link>
          <TileActions
            metric={tileId}
            tileId={tileId}
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-zoru-ink-muted">
            No cost data captured yet — provider price/cost fields are
            populated by the engine after a real send.
          </p>
        ) : (
          <ZoruChartContainer height={260}>
            {variant === "margin" ? (
              <ZoruChart.BarChart
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
                <ZoruChart.Bar
                  dataKey="cost"
                  stackId="m"
                  fill={ZORU_CHART_PALETTE[3]}
                  name="Cost"
                />
                <ZoruChart.Bar
                  dataKey="margin"
                  stackId="m"
                  fill={ZORU_CHART_PALETTE[0]}
                  name="Margin"
                />
              </ZoruChart.BarChart>
            ) : (
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
                  dataKey="cost"
                  stroke={ZORU_CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Cost"
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={ZORU_CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </ZoruChart.LineChart>
            )}
          </ZoruChartContainer>
        )}
      </ZoruCardContent>
    </Card>
  );
}
