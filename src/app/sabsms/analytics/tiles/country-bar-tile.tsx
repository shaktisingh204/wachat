"use client";

import Link from "next/link";

import { CHART_PALETTE, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/sabcrm/20ui';

import { TileActions } from "./tile-actions";
import type { SabsmsCountryBar } from "../aggregations";

const chartConfig = {
  sent: { label: "Sent", color: CHART_PALETTE[0] },
} satisfies ChartConfig;

export interface CountryBarTileProps {
  rows: SabsmsCountryBar[];
  drilldownHref: string;
  queryString: string;
}

export function CountryBarTile({
  rows,
  drilldownHref,
  queryString,
}: CountryBarTileProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Top countries</CardTitle>
          <CardDescription>
            Outbound volume by ISO country.
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
            metric="top-countries"
            tileId="top-countries"
            queryString={queryString}
          />
        </div>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--st-text-secondary)]">
            No traffic in this window.
          </p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: Math.max(180, Math.min(rows.length, 20) * 20) }}
          >
            <Recharts.BarChart
              data={rows.slice(0, 20)}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
            >
              <Recharts.CartesianGrid
                strokeDasharray="3 3"
                className="stroke-[var(--st-border)]"
              />
              <Recharts.XAxis
                type="number"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Recharts.YAxis
                type="category"
                dataKey="country"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Recharts.Bar
                dataKey="sent"
                fill={CHART_PALETTE[0]}
                radius={[2, 2, 2, 2]}
              />
            </Recharts.BarChart>
          </ChartContainer>
        )}
      </CardBody>
    </Card>
  );
}
