"use client";

/**
 * V2.10 — cost & margin analytics client. Renders ONLY real data passed
 * from the server component (rollup `sabsms_stats_daily` cost/credit
 * counters + raw `cost`/`price` sums for revenue/margin). No mock
 * numbers, no fabricated deltas — empty states everywhere instead.
 */

import React from "react";
import Link from "next/link";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  CHART_PALETTE,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type ChartConfig,
} from "@/components/sabcrm/20ui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

export interface CostKpis {
  costUsd: number;
  creditsSpent: number;
  sent: number;
  segments: number;
  avgCostPerMessageUsd: number;
  revenueUsd: number;
  marginUsd: number;
}

export interface CostDayPoint {
  date: string;
  costUsd: number;
  creditsSpent: number;
  sent: number;
  revenueUsd: number;
}

export interface ProviderCostRow {
  provider: string;
  sent: number;
  delivered: number;
  segments: number;
  creditsSpent: number;
  costUsd: number;
}

export interface CampaignCostRow {
  campaignId: string;
  name: string;
  sent: number;
  delivered: number;
  creditsSpent: number;
  costUsd: number;
  revenueUsd: number;
  marginUsd: number;
}

export interface CostAnalyticsClientProps {
  days: number;
  kpis: CostKpis;
  daySeries: CostDayPoint[];
  providerRows: ProviderCostRow[];
  campaignRows: CampaignCostRow[];
}

const dayChartConfig = {
  costUsd: { label: "Cost (USD)", color: CHART_PALETTE[0] },
  creditsSpent: { label: "Credits spent", color: CHART_PALETTE[1] },
} satisfies ChartConfig;

function usd(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CostAnalyticsClient({
  days,
  kpis,
  daySeries,
  providerRows,
  campaignRows,
}: CostAnalyticsClientProps) {
  const hasTraffic = kpis.sent > 0 || kpis.costUsd > 0 || kpis.creditsSpent > 0;
  const presetHref = (d: number) => `/sabsms/analytics/cost?preset=${d}d`;

  return (
    <SabsmsPageShell
      title="Cost & margin"
      description={`Spend, credits, and margin over the last ${days} days — read from the sabsms_stats_daily rollups (cost/credits) plus raw price sums for revenue.`}
      breadcrumbs={[
        { label: "Analytics", href: "/sabsms/analytics" },
        { label: "Cost" },
      ]}
      toolbar={
        <div className="flex items-center gap-1" role="group" aria-label="Date range">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={presetHref(d)}
              aria-current={days === d ? "page" : undefined}
              className={`rounded-[var(--st-radius)] border px-3 py-1.5 text-xs font-medium transition-colors ${
                days === d
                  ? "border-[var(--st-border-strong)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                  : "border-[var(--st-border)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      }
    >
      {/* KPI row — all real rollup/raw numbers. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total cost" value={usd(kpis.costUsd)} />
        <StatCard
          label="Credits spent"
          value={kpis.creditsSpent.toLocaleString()}
        />
        <StatCard label="Messages sent" value={kpis.sent.toLocaleString()} />
        <StatCard
          label="Avg cost / msg"
          value={kpis.sent > 0 ? usd(kpis.avgCostPerMessageUsd) : "—"}
        />
        <StatCard label="Revenue" value={usd(kpis.revenueUsd)} />
        <StatCard label="Margin" value={usd(kpis.marginUsd)} />
      </div>

      {/* Day series — costCents + creditsSpent from the rollups. */}
      <Card>
        <CardHeader>
          <CardTitle>Spend over time</CardTitle>
          <CardDescription>
            Daily cost (USD) and credits spent, bucketed on the UTC send day.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {!hasTraffic ? (
            <p className="py-12 text-center text-sm text-[var(--st-text-secondary)]">
              No spend in this window yet. Send a campaign and the rollups
              fill this chart automatically.
            </p>
          ) : (
            <ChartContainer config={dayChartConfig} className="h-[320px] w-full">
              <Recharts.ComposedChart
                data={daySeries}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <Recharts.CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--st-border)"
                />
                <Recharts.XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={24}
                  tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                />
                <Recharts.YAxis
                  yAxisId="cost"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                />
                <Recharts.YAxis
                  yAxisId="credits"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} verticalAlign="top" />
                <Recharts.Bar
                  yAxisId="cost"
                  dataKey="costUsd"
                  fill="var(--color-costUsd)"
                  radius={[3, 3, 0, 0]}
                  barSize={14}
                />
                <Recharts.Line
                  yAxisId="credits"
                  type="monotone"
                  dataKey="creditsSpent"
                  stroke="var(--color-creditsSpent)"
                  strokeWidth={2}
                  dot={false}
                />
              </Recharts.ComposedChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Per-provider cost table (rollup provider dim). */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by provider</CardTitle>
            <CardDescription>
              Rollup counters grouped on the provider dimension.
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            {providerRows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No provider-attributed traffic in this window.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Provider</Th>
                    <Th className="text-right">Sent</Th>
                    <Th className="text-right">Delivered</Th>
                    <Th className="text-right">Segments</Th>
                    <Th className="text-right">Credits</Th>
                    <Th className="text-right">Cost</Th>
                  </Tr>
                </THead>
                <TBody>
                  {providerRows.map((p) => (
                    <Tr key={p.provider}>
                      <Td className="font-mono text-xs">{p.provider}</Td>
                      <Td className="text-right text-xs">
                        {p.sent.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {p.delivered.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {p.segments.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {p.creditsSpent.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">{usd(p.costUsd)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {/* Per-campaign cost + margin column. */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by campaign</CardTitle>
            <CardDescription>
              Campaign-attributed cost (rollups) with revenue and margin from
              the raw price sums.
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            {campaignRows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No campaign-attributed traffic in this window.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Campaign</Th>
                    <Th className="text-right">Sent</Th>
                    <Th className="text-right">Credits</Th>
                    <Th className="text-right">Cost</Th>
                    <Th className="text-right">Revenue</Th>
                    <Th className="text-right">Margin</Th>
                  </Tr>
                </THead>
                <TBody>
                  {campaignRows.map((c) => (
                    <Tr key={c.campaignId}>
                      <Td className="max-w-[200px] truncate text-xs" title={c.name}>
                        {c.name}
                      </Td>
                      <Td className="text-right text-xs">
                        {c.sent.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {c.creditsSpent.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">{usd(c.costUsd)}</Td>
                      <Td className="text-right text-xs">{usd(c.revenueUsd)}</Td>
                      <Td className="text-right text-xs">
                        <Badge
                          variant={c.marginUsd >= 0 ? "default" : "secondary"}
                        >
                          {usd(c.marginUsd)}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
