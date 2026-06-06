"use client";

import Link from "next/link";

import { CHART_PALETTE, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';

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
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={drilldownHref}
            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            Open in logs
          </Link>
          <TileActions
            metric={tileId}
            tileId={tileId}
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--st-text-secondary)]">
            No cost data captured yet — provider price/cost fields are
            populated by the engine after a real send.
          </p>
        ) : (
          <ChartContainer height={260}>
            {variant === "margin" ? (
              <Recharts.BarChart
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
                <Recharts.Bar
                  dataKey="cost"
                  stackId="m"
                  fill={CHART_PALETTE[3]}
                  name="Cost"
                />
                <Recharts.Bar
                  dataKey="margin"
                  stackId="m"
                  fill={CHART_PALETTE[0]}
                  name="Margin"
                />
              </Recharts.BarChart>
            ) : (
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
                  dataKey="cost"
                  stroke={CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Cost"
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </Recharts.LineChart>
            )}
          </ChartContainer>
        )}
      </CardBody>
    </Card>
  );
}
