import Link from "next/link";

import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

import {
  MAX_BUCKETS,
  buildLogsDrilldownHref,
  runCohort,
  runCostVsRevenue,
  runFunnel,
  runGroupBy,
  runKpiCounts,
  runProviderScorecard,
  runTemplateReplyRates,
  runTimeSeries,
  runTopContacts,
  runTopCountries,
  type SabsmsAnalyticsFilter,
  type SabsmsAnalyticsGroupBy,
} from "./aggregations";
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
  kpi: Awaited<ReturnType<typeof runKpiCounts>>;
  compareKpi?: Awaited<ReturnType<typeof runKpiCounts>>;
  timeSeries: Awaited<ReturnType<typeof runTimeSeries>>;
  grouped: Awaited<ReturnType<typeof runGroupBy>>;
  funnel: Awaited<ReturnType<typeof runFunnel>>;
  cohort: Awaited<ReturnType<typeof runCohort>>;
  providerScores: Awaited<ReturnType<typeof runProviderScorecard>>;
  countries: Awaited<ReturnType<typeof runTopCountries>>;
  topContacts: Awaited<ReturnType<typeof runTopContacts>>;
  costSeries: Awaited<ReturnType<typeof runCostVsRevenue>>;
  templateReplies: Awaited<ReturnType<typeof runTemplateReplyRates>>;
}

const EMPTY_KPI = {
  sent: 0,
  delivered: 0,
  failed: 0,
  replied: 0,
  clicked: 0,
  optOut: 0,
} as const;

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
  cohort: [],
  providerScores: [],
  countries: [],
  topContacts: [],
  costSeries: [],
  templateReplies: [],
};

async function loadAll(filter: SabsmsAnalyticsFilter): Promise<PageData> {
  const { db } = await connectToDatabase();
  const [
    kpi,
    compareKpi,
    timeSeries,
    grouped,
    funnel,
    cohort,
    providerScores,
    countries,
    topContacts,
    costSeries,
    templateReplies,
  ] = await Promise.all([
    runKpiCounts(db, filter),
    filter.compareFrom && filter.compareTo
      ? runKpiCounts(db, filter, "compare")
      : Promise.resolve(undefined),
    runTimeSeries(db, filter),
    runGroupBy(db, filter),
    runFunnel(db, filter),
    runCohort(db, filter),
    runProviderScorecard(db, filter),
    runTopCountries(db, filter),
    runTopContacts(db, filter),
    runCostVsRevenue(db, filter),
    runTemplateReplyRates(db, filter),
  ]);
  return {
    filter,
    kpi,
    compareKpi,
    timeSeries,
    grouped,
    funnel,
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

export default async function SabsmsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

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

  const kpiTiles = [
    {
      metric: "sent",
      label: "Sent",
      value: data.kpi.sent + data.kpi.delivered + data.kpi.failed,
      previous: data.compareKpi
        ? data.compareKpi.sent +
          data.compareKpi.delivered +
          data.compareKpi.failed
        : undefined,
    },
    {
      metric: "delivered",
      label: "Delivered",
      value: data.kpi.delivered,
      previous: data.compareKpi?.delivered,
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
      label: "Replied",
      value: data.kpi.replied,
      previous: data.compareKpi?.replied,
    },
    {
      metric: "clicked",
      label: "Clicked",
      value: data.kpi.clicked,
      previous: data.compareKpi?.clicked,
    },
    {
      metric: "optOut",
      label: "Opt-out",
      value: data.kpi.optOut,
      previous: data.compareKpi?.optOut,
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
          Every chart reads directly from{" "}
          <code className="rounded bg-zoru-surface-2 px-1">
            sabsms_messages
          </code>{" "}
          and friends — there is no precomputed materialised view, so
          numbers stay correct without a backfill. Each tile has an
          &quot;Open in logs&quot; link for drill-down and an AI button for
          context. Max {MAX_BUCKETS} buckets per aggregation.
        </>
      }
      toolbar={
        <AnalyticsToolbar
          csvRows={csvRows}
          providers={providerOptions}
          countries={countryOptions}
          campaigns={campaignOptions}
        />
      }
    >
      {/* KPI strip — 6 ZoruStatCards. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiTiles.map((k) => (
          <KpiTile
            key={k.metric}
            metric={k.metric}
            label={k.label}
            value={k.value}
            previous={k.previous}
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
        <ZoruCardHeader>
          <ZoruCardTitle>By {groupBy}</ZoruCardTitle>
          <ZoruCardDescription>
            Outbound counts grouped by{" "}
            <span className="font-medium">{groupBy}</span> in the current
            window.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          {data.grouped.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zoru-ink-muted">
              No data yet — try a wider date range or switch group-by.
            </p>
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>{groupBy}</ZoruTableHead>
                  <ZoruTableHead className="text-right">Sent</ZoruTableHead>
                  <ZoruTableHead className="text-right">
                    Delivered
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right">Failed</ZoruTableHead>
                  <ZoruTableHead className="text-right">DLR %</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {data.grouped.slice(0, 50).map((g) => (
                  <ZoruTableRow key={g.bucket}>
                    <ZoruTableCell className="font-mono text-xs">
                      {g.bucket}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {g.sent.toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {g.delivered.toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {g.failed.toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      <Badge
                        variant={
                          g.deliveryRate >= 95 ? "default" : "secondary"
                        }
                      >
                        {g.deliveryRate}%
                      </Badge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>

      <DashboardGrid items={gridItems} workspaceId={workspaceId || "anon"} />

      {/* CTR + conversions tables — surfaced as inline cards so the layout
          stays predictable even when these collections are empty. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>CTR per link</ZoruCardTitle>
            <ZoruCardDescription>
              Click-through rate per short link. Populated when the engine
              writes to{" "}
              <code className="rounded bg-zoru-surface-2 px-1 text-xs">
                sabsms_link_clicks
              </code>
              .
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <p className="text-sm text-zoru-ink-muted">
              No link clicks yet in this window. Once you send a campaign
              with a tracked short link, this table fills automatically.
            </p>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Conversions</ZoruCardTitle>
            <ZoruCardDescription>
              Server pixel + on-site JS. Shows columns even with no data so
              you can wire the pixel.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Event</ZoruTableHead>
                  <ZoruTableHead className="text-right">
                    Conversions
                  </ZoruTableHead>
                  <ZoruTableHead className="text-right">Revenue</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={3}
                    className="px-6 py-8 text-center text-sm text-zoru-ink-muted"
                  >
                    No conversions tracked yet.{" "}
                    <Link
                      href="/sabsms/settings"
                      className="underline underline-offset-2"
                    >
                      Configure pixel
                    </Link>
                    .
                  </ZoruTableCell>
                </ZoruTableRow>
              </ZoruTableBody>
            </Table>
          </ZoruCardContent>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}
