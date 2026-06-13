import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import React from "react";
import Link from "next/link";

import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

import { ObjectId } from "mongodb";

import {
  buildLogsDrilldownHref,
  runCohort,
  runCostVsRevenue,
  runErrorPareto,
  runGroupBy,
  runProviderScorecard,
  runRecentRiskEvents,
  runTemplateReplyRates,
  runTopContacts,
  runTopCountries,
  type SabsmsAnalyticsFilter,
  type SabsmsAnalyticsGroupBy,
  type SabsmsErrorParetoRow,
  type SabsmsFunnelStep,
  type SabsmsGroupedRow,
  type SabsmsRiskEvent,
  type SabsmsTimeSeriesPoint,
} from "./aggregations";
// V2.10 — KPI / series / group-by / funnel read the `sabsms_stats_daily`
// rollups (written live by the events consumer; backfilled by
// `scripts/sabsms-backfill-stats.mjs`) instead of aggregating raw
// messages on every page load.
import {
  groupRowsByDim,
  kpisFromRows,
  queryDailyStats,
  seriesFromRows,
  utcDateKey,
  type SabsmsStatsKpis,
} from "@/lib/sabsms/analytics/rollups";
import { RecomputeButton } from "./recompute-button";
import { DashboardGrid } from "./dashboard-grid";
import { AnalyticsToolbar } from "./toolbar";
import { CohortTile } from "./tiles/cohort-tile";
import { CostVsRevenueTile } from "./tiles/cost-vs-revenue-tile";
import { CountryBarTile } from "./tiles/country-bar-tile";
import { FunnelTile } from "./tiles/funnel-tile";
import { KpiTile } from "./tiles/kpi-tile";
import { ProviderScorecardTile } from "./tiles/provider-scorecard-tile";
import { TemplateReplyRateTile } from "./tiles/template-reply-rate-tile";
import { TimeSeriesTile } from "./tiles/time-series-tile";
import { TopContactsTile } from "./tiles/top-contacts-tile";

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

interface ParsedRange {
  from: Date;
  to: Date;
  compareFrom?: Date;
  compareTo?: Date;
  preset: string;
  compareKind: "none" | "previous_period" | "previous_year";
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function asStringArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function parseRange(sp: RawSearchParams): ParsedRange {
  const now = new Date();
  const preset = asString(sp.preset) ?? "30d";
  const compareKind = (asString(sp.compareTo) ?? "none") as
    | "none"
    | "previous_period"
    | "previous_year";

  const explicitFrom = asString(sp.from);
  const explicitTo = asString(sp.to);

  let from: Date;
  let to: Date = now;

  if (explicitFrom && explicitTo) {
    from = new Date(explicitFrom);
    to = new Date(explicitTo);
  } else if (preset === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (preset === "7d") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === "90d") {
    from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (preset === "custom" && explicitFrom) {
    from = new Date(explicitFrom);
    if (explicitTo) to = new Date(explicitTo);
  } else {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const span = to.getTime() - from.getTime();
  let compareFrom: Date | undefined;
  let compareTo: Date | undefined;
  if (compareKind === "previous_period") {
    compareTo = new Date(from.getTime() - 1);
    compareFrom = new Date(compareTo.getTime() - span);
  } else if (compareKind === "previous_year") {
    compareFrom = new Date(from);
    compareFrom.setFullYear(compareFrom.getFullYear() - 1);
    compareTo = new Date(to);
    compareTo.setFullYear(compareTo.getFullYear() - 1);
  }

  return { from, to, compareFrom, compareTo, preset, compareKind };
}

function parseGroupBy(
  sp: RawSearchParams,
): SabsmsAnalyticsGroupBy {
  const raw = asString(sp.groupBy);
  if (
    raw === "provider" ||
    raw === "country" ||
    raw === "sender" ||
    raw === "campaign" ||
    raw === "template"
  )
    return raw;
  return "provider";
}

interface PageData {
  filter: SabsmsAnalyticsFilter;
  kpi: SabsmsStatsKpis;
  compareKpi?: SabsmsStatsKpis;
  timeSeries: SabsmsTimeSeriesPoint[];
  grouped: SabsmsGroupedRow[];
  funnel: SabsmsFunnelStep[];
  errorPareto: SabsmsErrorParetoRow[];
  riskEvents: SabsmsRiskEvent[];
  cohort: Awaited<ReturnType<typeof runCohort>>;
  providerScores: Awaited<ReturnType<typeof runProviderScorecard>>;
  countries: Awaited<ReturnType<typeof runTopCountries>>;
  topContacts: Awaited<ReturnType<typeof runTopContacts>>;
  costSeries: Awaited<ReturnType<typeof runCostVsRevenue>>;
  templateReplies: Awaited<ReturnType<typeof runTemplateReplyRates>>;
}

const EMPTY_KPI: SabsmsStatsKpis = {
  queued: 0,
  sent: 0,
  delivered: 0,
  failed: 0,
  inbound: 0,
  optOuts: 0,
  clicks: 0,
  segments: 0,
  costCents: 0,
  creditsSpent: 0,
  deliveryRatePct: 0,
  ctrPct: 0,
};

const EMPTY_DATA: PageData = {
  filter: {
    workspaceId: "",
    from: new Date(),
    to: new Date(),
  },
  kpi: { ...EMPTY_KPI },
  timeSeries: [],
  grouped: [],
  funnel: [],
  errorPareto: [],
  riskEvents: [],
  cohort: [],
  providerScores: [],
  countries: [],
  topContacts: [],
  costSeries: [],
  templateReplies: [],
};

/** Funnel from rollup totals: sent → delivered → clicked (drop-off %). */
function funnelFromKpis(kpi: SabsmsStatsKpis): SabsmsFunnelStep[] {
  const raw = [
    { step: "Sent", value: kpi.sent },
    { step: "Delivered", value: kpi.delivered },
    { step: "Clicked", value: kpi.clicks },
  ];
  return raw.map((s, i) => {
    if (i === 0) return { ...s, drop: 0 };
    const prev = raw[i - 1].value;
    const drop = prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : 0;
    return { ...s, drop };
  });
}

/** Hydrate campaign-id buckets into names (single `$in` roundtrip). */
async function campaignNames(
  db: Awaited<ReturnType<typeof connectToDatabase>>["db"],
  workspaceId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (objectIds.length === 0) return new Map();
  const docs = await db
    .collection<{ _id: ObjectId; name?: string }>("sabsms_campaigns")
    .find({ _id: { $in: objectIds }, workspaceId } as never)
    .project<{ _id: ObjectId; name?: string }>({ name: 1 })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), d.name ?? String(d._id)]));
}

async function loadAll(filter: SabsmsAnalyticsFilter): Promise<PageData> {
  const { db } = await connectToDatabase();
  const groupBy = filter.groupBy ?? "provider";
  const range = {
    workspaceId: filter.workspaceId,
    fromDate: utcDateKey(filter.from.getTime()),
    toDate: utcDateKey(filter.to.getTime()),
  };
  const rollupDim = groupBy === "campaign" ? ("campaignId" as const) : ("provider" as const);
  const rollupGrouped = groupBy === "provider" || groupBy === "campaign";

  const [
    totalRows,
    compareRows,
    dimRows,
    rawGrouped,
    errorPareto,
    riskEvents,
    cohort,
    providerScores,
    countries,
    topContacts,
    costSeries,
    templateReplies,
  ] = await Promise.all([
    queryDailyStats(db, { ...range, dim: "total" }),
    filter.compareFrom && filter.compareTo
      ? queryDailyStats(db, {
          ...range,
          fromDate: utcDateKey(filter.compareFrom.getTime()),
          toDate: utcDateKey(filter.compareTo.getTime()),
          dim: "total",
        })
      : Promise.resolve(undefined),
    rollupGrouped
      ? queryDailyStats(db, { ...range, dim: rollupDim })
      : Promise.resolve([]),
    // country / sender / template group-bys have no rollup dim (the
    // fan-out is bounded to provider+campaign) — keep the raw path.
    rollupGrouped ? Promise.resolve([]) : runGroupBy(db, filter),
    runErrorPareto(db, filter.workspaceId),
    runRecentRiskEvents(db, filter.workspaceId),
    runCohort(db, filter),
    runProviderScorecard(db, filter),
    runTopCountries(db, filter),
    runTopContacts(db, filter),
    runCostVsRevenue(db, filter),
    runTemplateReplyRates(db, filter),
  ]);

  const kpi = kpisFromRows(totalRows);
  const timeSeries = seriesFromRows(totalRows, range.fromDate, range.toDate).map(
    (p) => ({ date: p.date, sent: p.sent, delivered: p.delivered, failed: p.failed }),
  );

  let grouped: SabsmsGroupedRow[];
  if (rollupGrouped) {
    const buckets = groupRowsByDim(dimRows, rollupDim);
    const names =
      rollupDim === "campaignId"
        ? await campaignNames(db, filter.workspaceId, buckets.map((b) => b.bucket))
        : new Map<string, string>();
    grouped = buckets.map(({ bucket, counters }) => ({
      bucket: names.get(bucket) ?? bucket,
      sent: counters.sent,
      delivered: counters.delivered,
      failed: counters.failed,
      deliveryRate:
        counters.sent > 0 ? Math.round((counters.delivered / counters.sent) * 100) : 0,
    }));
  } else {
    grouped = rawGrouped;
  }

  return {
    filter,
    kpi,
    compareKpi: compareRows ? kpisFromRows(compareRows) : undefined,
    timeSeries,
    grouped,
    funnel: funnelFromKpis(kpi),
    errorPareto,
    riskEvents,
    cohort,
    providerScores,
    countries,
    topContacts,
    costSeries,
    templateReplies,
  };
}

function buildQueryString(filter: SabsmsAnalyticsFilter): string {
  const params = new URLSearchParams();
  params.set("from", filter.from.toISOString());
  params.set("to", filter.to.toISOString());
  if (filter.groupBy) params.set("groupBy", filter.groupBy);
  for (const p of filter.providers ?? []) params.append("provider", p);
  for (const c of filter.countries ?? []) params.append("country", c);
  for (const cid of filter.campaignIds ?? []) params.append("campaign", cid);
  return params.toString();
}

async function SabsmsAnalyticsPageContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";

  const range = parseRange(sp);
  const groupBy = parseGroupBy(sp);

  const filter: SabsmsAnalyticsFilter = {
    workspaceId,
    from: range.from,
    to: range.to,
    compareFrom: range.compareFrom,
    compareTo: range.compareTo,
    groupBy,
    providers: asStringArray(sp.provider),
    countries: asStringArray(sp.country),
    campaignIds: asStringArray(sp.campaign),
  };

  const data: PageData = workspaceId
    ? await loadAll(filter)
    : { ...EMPTY_DATA, filter };

  const queryString = buildQueryString(filter);
  const baseDrill = buildLogsDrilldownHref(filter);

  // Facet option lists — derived from the grouped + countries + scorecard
  // results so the filter chips only show providers / countries / campaigns
  // that actually have traffic in this window.
  const providerOptions = data.providerScores.map((p) => ({
    value: p.provider,
    label: p.provider,
  }));
  const countryOptions = data.countries.map((c) => ({
    value: c.country,
    label: c.country,
  }));
  const campaignOptions = (
    filter.groupBy === "campaign" ? data.grouped : []
  ).map((g) => ({ value: g.bucket, label: g.bucket }));

  // CSV rows for the export menu — the time series is the most useful
  // "raw" form of the current view.
  const csvRows = data.timeSeries.map((p) => ({
    date: p.date,
    sent: p.sent,
    delivered: p.delivered,
    failed: p.failed,
  }));

  // Rollup counter semantics: `sent` counts every messageSent event
  // (later-delivered ones included), so it IS the send volume — no
  // status-bucket summing like the old raw-aggregation path.
  const kpiTiles: Array<{
    metric: string;
    label: string;
    value: number;
    previous?: number;
    invertDelta?: boolean;
    suffix?: string;
  }> = [
    {
      metric: "sent",
      label: "Sent",
      value: data.kpi.sent,
      previous: data.compareKpi?.sent,
    },
    {
      metric: "delivered",
      label: "Delivered",
      value: data.kpi.delivered,
      previous: data.compareKpi?.delivered,
    },
    {
      metric: "deliveryRate",
      label: "Delivery rate",
      value: data.kpi.deliveryRatePct,
      previous: data.compareKpi?.deliveryRatePct,
      suffix: "%",
    },
    {
      metric: "failed",
      label: "Failed",
      value: data.kpi.failed,
      previous: data.compareKpi?.failed,
      invertDelta: true,
    },
    {
      metric: "replied",
      label: "Replies",
      value: data.kpi.inbound,
      previous: data.compareKpi?.inbound,
    },
    {
      metric: "clicked",
      label: "Clicks",
      value: data.kpi.clicks,
      previous: data.compareKpi?.clicks,
    },
    {
      metric: "ctr",
      label: "CTR",
      value: data.kpi.ctrPct,
      previous: data.compareKpi?.ctrPct,
      suffix: "%",
    },
    {
      metric: "optOut",
      label: "Opt-outs",
      value: data.kpi.optOuts,
      previous: data.compareKpi?.optOuts,
      invertDelta: true,
    },
  ];

  const gridItems = [
    {
      id: "time-series",
      span: 2 as const,
      node: (
        <TimeSeriesTile
          data={data.timeSeries}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "funnel",
      node: (
        <FunnelTile
          steps={data.funnel}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "cohort",
      node: (
        <CohortTile
          cells={data.cohort}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "provider-scorecard",
      node: (
        <ProviderScorecardTile
          rows={data.providerScores}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "number-health",
      node: (
        <ProviderScorecardTile
          rows={data.providerScores}
          drilldownHref={baseDrill}
          queryString={queryString}
          numberHealth
        />
      ),
    },
    {
      id: "countries",
      node: (
        <CountryBarTile
          rows={data.countries}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "top-contacts",
      node: (
        <TopContactsTile
          rows={data.topContacts}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "cost-vs-revenue",
      node: (
        <CostVsRevenueTile
          data={data.costSeries}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
    {
      id: "margin",
      node: (
        <CostVsRevenueTile
          data={data.costSeries}
          drilldownHref={baseDrill}
          queryString={queryString}
          variant="margin"
        />
      ),
    },
    {
      id: "template-replies",
      node: (
        <TemplateReplyRateTile
          rows={data.templateReplies}
          drilldownHref={baseDrill}
          queryString={queryString}
        />
      ),
    },
  ];

  return (
    <SabsmsPageShell
      title="Analytics"
      description="Outbound performance, replies, cost, and the long-tail of provider health. Capped at the most-recent 100 buckets per query to stay snappy on large tenants."
      breadcrumbs={[{ label: "Analytics" }]}
      helpTitle="How analytics works"
      helpBody={
        <>
          KPIs, the day series, the funnel, and the provider/campaign
          group-bys read the{" "}
          <code className="rounded bg-[var(--st-bg-muted)] px-1">
            sabsms_stats_daily
          </code>{" "}
          rollups (written live by the events consumer; backfilled with{" "}
          <code className="rounded bg-[var(--st-bg-muted)] px-1">
            scripts/sabsms-backfill-stats.mjs
          </code>
          ). The live counters are at-least-once — if a number looks off,
          &quot;Recompute&quot; rebuilds the visible day range from the raw
          collections. The long-tail tiles still aggregate{" "}
          <code className="rounded bg-[var(--st-bg-muted)] px-1">
            sabsms_messages
          </code>{" "}
          directly. Each tile has an &quot;Open in logs&quot; drill-down.
        </>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <RecomputeButton
            fromDate={utcDateKey(filter.from.getTime())}
            toDate={utcDateKey(filter.to.getTime())}
          />
          <AnalyticsToolbar
            csvRows={csvRows}
            providers={providerOptions}
            countries={countryOptions}
            campaigns={campaignOptions}
          />
        </div>
      }
    >
      {/* KPI strip — 8 rollup-backed Ui20StatCards. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpiTiles.map((k) => (
          <KpiTile
            key={k.metric}
            metric={k.metric}
            label={k.label}
            value={k.value}
            previous={k.previous}
            suffix={k.suffix}
            drilldownHref={buildLogsDrilldownHref(filter, {
              status:
                k.metric === "delivered"
                  ? "delivered"
                  : k.metric === "failed"
                    ? "failed"
                    : undefined,
            })}
            queryString={queryString}
            invertDelta={k.invertDelta}
          />
        ))}
      </div>

      {/* Group-by table — driven by the URL ?groupBy=… selector. */}
      <Card>
        <CardHeader>
          <CardTitle>By {groupBy}</CardTitle>
          <CardDescription>
            Outbound counts grouped by{" "}
            <span className="font-medium">{groupBy}</span> in the current
            window.
          </CardDescription>
        </CardHeader>
        <CardBody className="p-0">
          {data.grouped.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
              No data yet — try a wider date range or switch group-by.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>{groupBy}</Th>
                  <Th className="text-right">Sent</Th>
                  <Th className="text-right">
                    Delivered
                  </Th>
                  <Th className="text-right">Failed</Th>
                  <Th className="text-right">DLR %</Th>
                </Tr>
              </THead>
              <TBody>
                {data.grouped.slice(0, 50).map((g) => (
                  <Tr key={g.bucket}>
                    <Td className="font-mono text-xs">
                      {g.bucket}
                    </Td>
                    <Td className="text-right text-xs">
                      {g.sent.toLocaleString()}
                    </Td>
                    <Td className="text-right text-xs">
                      {g.delivered.toLocaleString()}
                    </Td>
                    <Td className="text-right text-xs">
                      {g.failed.toLocaleString()}
                    </Td>
                    <Td className="text-right text-xs">
                      <Badge
                        variant={
                          g.deliveryRate >= 95 ? "default" : "secondary"
                        }
                      >
                        {g.deliveryRate}%
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <DashboardGrid items={gridItems} workspaceId={workspaceId || "anon"} />

      {/* V2.10 — error Pareto (7d, normalizedCode) + routing/fraud feed. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Error Pareto — last 7 days</CardTitle>
            <CardDescription>
              Top normalized failure codes across all providers (fixed 7-day
              window — &quot;what is breaking right now&quot;).
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            {data.errorPareto.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No failures in the last 7 days.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Code</Th>
                    <Th className="text-right">Failures</Th>
                    <Th className="text-right">Share</Th>
                    <Th className="text-right">Cumulative</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.errorPareto.map((row) => (
                    <Tr key={row.code}>
                      <Td className="font-mono text-xs">
                        <Link
                          href={buildLogsDrilldownHref(filter, {
                            status: "failed",
                            code: row.code,
                          })}
                          className="hover:underline"
                        >
                          {row.code}
                        </Link>
                      </Td>
                      <Td className="text-right text-xs">
                        {row.count.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">{row.pct}%</Td>
                      <Td className="text-right text-xs">
                        <Badge
                          variant={
                            row.cumulativePct >= 80 ? "secondary" : "default"
                          }
                        >
                          {row.cumulativePct}%
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routing &amp; fraud incidents</CardTitle>
            <CardDescription>
              Recent{" "}
              <code className="rounded bg-[var(--st-bg-muted)] px-1 text-xs">
                routeFailover
              </code>{" "}
              /{" "}
              <code className="rounded bg-[var(--st-bg-muted)] px-1 text-xs">
                fraudBlocked
              </code>{" "}
              events from the consumer&apos;s 30-day event log.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {data.riskEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No failovers or fraud blocks in the last 30 days.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.riskEvents.map((e, i) => (
                  <li
                    key={`${e.kind}-${e.at}-${i}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={
                          e.kind === "fraudBlocked" ? "secondary" : "default"
                        }
                      >
                        {e.kind === "fraudBlocked" ? "Fraud" : "Failover"}
                      </Badge>
                      <span className="text-[var(--st-text)]">{e.summary}</span>
                    </div>
                    <time
                      dateTime={e.at}
                      className="shrink-0 text-xs text-[var(--st-text-secondary)]"
                    >
                      {e.at ? new Date(e.at).toLocaleString() : "—"}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}


export default function SabsmsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <SabsmsAnalyticsPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
