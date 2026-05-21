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
import type { SabsmsCountryBar } from "../aggregations";

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
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <ZoruCardTitle>Top countries</ZoruCardTitle>
          <ZoruCardDescription>
            Outbound volume by ISO country.
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
            metric="top-countries"
            tileId="top-countries"
            queryString={queryString}
          />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-zoru-ink-muted">
            No traffic in this window.
          </p>
        ) : (
          <ZoruChartContainer height={Math.max(180, rows.length * 20)}>
            <ZoruChart.BarChart
              data={rows.slice(0, 20)}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
            >
              <ZoruChart.CartesianGrid
                strokeDasharray="3 3"
                className="stroke-zoru-line"
              />
              <ZoruChart.XAxis
                type="number"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <ZoruChart.YAxis
                type="category"
                dataKey="country"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
              <ZoruChart.Bar
                dataKey="sent"
                fill={ZORU_CHART_PALETTE[0]}
                radius={[2, 2, 2, 2]}
              />
            </ZoruChart.BarChart>
          </ZoruChartContainer>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}
