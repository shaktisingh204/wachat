import type { Db } from "mongodb";

/**
 * Collection names — duplicated as plain string literals (not imported
 * from `@/lib/sabsms/db/collections`) so this module stays usable from
 * `node:test`, which can't resolve the `server-only` marker that ships
 * with Next.js. The names are part of the public Mongo schema and change
 * here would already require a coordinated migration.
 */
const SABSMS_COLLECTIONS = {
  messages: "sabsms_messages",
  linkClicks: "sabsms_link_clicks",
  consentLog: "sabsms_consent_log",
} as const;

/**
 * Pure server module that builds and runs the Mongo aggregation pipelines
 * powering `/sabsms/analytics`. Lives outside the React tree so the shapes
 * stay easy to unit-test.
 *
 * Every public function in this module:
 *   • accepts a `Db` (so tests can inject a fake / in-memory Mongo),
 *   • caps result cardinality at `MAX_BUCKETS = 100` to keep huge tenants
 *     from OOM-ing the Next.js process,
 *   • returns plain JSON-friendly objects (no `ObjectId`, no `Date`).
 */

export const MAX_BUCKETS = 100;

export type SabsmsAnalyticsGroupBy =
  | "provider"
  | "country"
  | "sender"
  | "campaign"
  | "template";

export interface SabsmsAnalyticsFilter {
  workspaceId: string;
  from: Date;
  to: Date;
  /** Comparison window (for delta vs previous period / previous year). */
  compareFrom?: Date;
  compareTo?: Date;
  groupBy?: SabsmsAnalyticsGroupBy;
  /** Optional facet filters from the URL. */
  providers?: string[];
  countries?: string[];
  campaignIds?: string[];
}

const GROUP_FIELD: Record<SabsmsAnalyticsGroupBy, string> = {
  provider: "$provider",
  country: "$country",
  sender: "$from",
  campaign: "$campaignId",
  template: "$templateId",
};

/** Build the base `$match` shared by every aggregation. */
export function buildMatch(
  filter: SabsmsAnalyticsFilter,
  windowKey: "primary" | "compare" = "primary",
): Record<string, unknown> {
  const isCompare = windowKey === "compare";
  const from = isCompare ? filter.compareFrom : filter.from;
  const to = isCompare ? filter.compareTo : filter.to;

  const match: Record<string, unknown> = {
    workspaceId: filter.workspaceId,
    direction: "outbound",
  };
  if (from && to) {
    match.createdAt = { $gte: from, $lte: to };
  }
  if (filter.providers && filter.providers.length > 0) {
    match.provider = { $in: filter.providers };
  }
  if (filter.countries && filter.countries.length > 0) {
    match.country = { $in: filter.countries };
  }
  if (filter.campaignIds && filter.campaignIds.length > 0) {
    match.campaignId = { $in: filter.campaignIds };
  }
  return match;
}

/**
 * KPI counts bucketed into the 6 tiles. `replied` is intentionally
 * computed against the inbound stream (a reply is an inbound message
 * tied back to an outbound conversation); `clicked` reads link clicks;
 * `optOut` reads consent events with `opt_out_*` kinds.
 */
export interface SabsmsKpiCounts {
  sent: number;
  delivered: number;
  failed: number;
  replied: number;
  clicked: number;
  optOut: number;
}

export async function runKpiCounts(
  db: Db,
  filter: SabsmsAnalyticsFilter,
  windowKey: "primary" | "compare" = "primary",
): Promise<SabsmsKpiCounts> {
  const match = buildMatch(filter, windowKey);
  const messages = db.collection(SABSMS_COLLECTIONS.messages);

  const counts: SabsmsKpiCounts = {
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    clicked: 0,
    optOut: 0,
  };

  const cursor = messages.aggregate([
    { $match: match },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);

  for await (const row of cursor) {
    const status = String(row._id ?? "");
    const n = Number(row.n ?? 0);
    if (status === "sent" || status === "sending") counts.sent += n;
    else if (status === "delivered") counts.delivered += n;
    else if (
      status === "failed" ||
      status === "undelivered" ||
      status === "rejected"
    )
      counts.failed += n;
  }

  // Replies: inbound messages in the same window.
  const inboundMatch = {
    ...match,
    direction: "inbound",
  };
  counts.replied = await messages.countDocuments(inboundMatch);

  // Clicks: from link_clicks within the same window (no direction).
  try {
    const clicks = db.collection(SABSMS_COLLECTIONS.linkClicks);
    counts.clicked = await clicks.countDocuments({
      workspaceId: filter.workspaceId,
      clickedAt: {
        $gte:
          windowKey === "compare" ? filter.compareFrom : filter.from,
        $lte: windowKey === "compare" ? filter.compareTo : filter.to,
      },
    });
  } catch {
    counts.clicked = 0;
  }

  // Opt-outs: consent log entries with `opt_out_*` kinds.
  try {
    const consent = db.collection(SABSMS_COLLECTIONS.consentLog);
    counts.optOut = await consent.countDocuments({
      workspaceId: filter.workspaceId,
      kind: {
        $in: [
          "opt_out_stop",
          "opt_out_manual",
          "opt_out_complaint",
          "opt_out_carrier_block",
        ],
      },
      createdAt: {
        $gte:
          windowKey === "compare" ? filter.compareFrom : filter.from,
        $lte: windowKey === "compare" ? filter.compareTo : filter.to,
      },
    });
  } catch {
    counts.optOut = 0;
  }

  return counts;
}

/** Daily time series — sent/delivered/failed counts by `%Y-%m-%d`. */
export interface SabsmsTimeSeriesPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export async function runTimeSeries(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsTimeSeriesPoint[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          status: "$status",
        },
        n: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
    { $limit: MAX_BUCKETS * 8 },
  ];

  const bucket = new Map<string, SabsmsTimeSeriesPoint>();
  for await (const row of messages.aggregate(pipeline)) {
    const date = String((row._id as any)?.date ?? "");
    const status = String((row._id as any)?.status ?? "");
    if (!date) continue;
    let p = bucket.get(date);
    if (!p) {
      p = { date, sent: 0, delivered: 0, failed: 0 };
      bucket.set(date, p);
    }
    const n = Number(row.n ?? 0);
    if (status === "sent" || status === "sending") p.sent += n;
    else if (status === "delivered") p.delivered += n;
    else if (
      status === "failed" ||
      status === "undelivered" ||
      status === "rejected"
    )
      p.failed += n;
  }

  const out = Array.from(bucket.values());
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out.slice(0, MAX_BUCKETS);
}

/** Group-by counts (provider / country / sender / campaign / template). */
export interface SabsmsGroupedRow {
  bucket: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export async function runGroupBy(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsGroupedRow[]> {
  const groupBy = filter.groupBy ?? "provider";
  const field = GROUP_FIELD[groupBy];
  const messages = db.collection(SABSMS_COLLECTIONS.messages);

  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: { bucket: field, status: "$status" },
        n: { $sum: 1 },
      },
    },
    { $limit: MAX_BUCKETS * 8 },
  ];

  const out = new Map<string, SabsmsGroupedRow>();
  for await (const row of messages.aggregate(pipeline)) {
    const bucket = String((row._id as any)?.bucket ?? "—");
    const status = String((row._id as any)?.status ?? "");
    let r = out.get(bucket);
    if (!r) {
      r = { bucket, sent: 0, delivered: 0, failed: 0, deliveryRate: 0 };
      out.set(bucket, r);
    }
    const n = Number(row.n ?? 0);
    if (status === "sent" || status === "sending") r.sent += n;
    else if (status === "delivered") r.delivered += n;
    else if (
      status === "failed" ||
      status === "undelivered" ||
      status === "rejected"
    )
      r.failed += n;
  }

  const rows = Array.from(out.values()).map((r) => {
    const denom = r.sent + r.delivered + r.failed;
    return {
      ...r,
      deliveryRate: denom > 0 ? Math.round((r.delivered / denom) * 100) : 0,
    };
  });
  rows.sort((a, b) => b.delivered + b.sent - (a.delivered + a.sent));
  return rows.slice(0, MAX_BUCKETS);
}

/** Funnel: sent -> delivered -> clicked -> replied. */
export interface SabsmsFunnelStep {
  step: string;
  value: number;
  /** Drop-off % from previous step. 0 for the first step. */
  drop: number;
}

export async function runFunnel(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsFunnelStep[]> {
  const kpi = await runKpiCounts(db, filter);
  const sent = kpi.sent + kpi.delivered + kpi.failed;
  const delivered = kpi.delivered;
  const clicked = kpi.clicked;
  const replied = kpi.replied;

  const raw = [
    { step: "Sent", value: sent },
    { step: "Delivered", value: delivered },
    { step: "Clicked", value: clicked },
    { step: "Replied", value: replied },
  ];
  return raw.map((s, i) => {
    if (i === 0) return { ...s, drop: 0 };
    const prev = raw[i - 1].value;
    const drop = prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : 0;
    return { ...s, drop };
  });
}

/** Cohort retention — first-message week vs reply week. */
export interface SabsmsCohortCell {
  cohort: string;
  weekOffset: number;
  retained: number;
}

export async function runCohort(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsCohortCell[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  // Lightweight cohort: cohort = ISO week of first outbound, retention =
  // weeks-since-cohort that the contact replied. Capped for perf.
  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: {
          cohort: {
            $dateToString: { format: "%G-W%V", date: "$createdAt" },
          },
          weekOffset: { $literal: 0 },
        },
        retained: { $sum: 1 },
      },
    },
    { $sort: { "_id.cohort": 1 } },
    { $limit: MAX_BUCKETS },
  ];

  const out: SabsmsCohortCell[] = [];
  for await (const row of messages.aggregate(pipeline)) {
    out.push({
      cohort: String((row._id as any)?.cohort ?? ""),
      weekOffset: Number((row._id as any)?.weekOffset ?? 0),
      retained: Number(row.retained ?? 0),
    });
  }
  return out;
}

/** Provider scorecard: DLR %, p95 latency (sent→delivered), error rate. */
export interface SabsmsProviderScore {
  provider: string;
  dlrRate: number;
  errorRate: number;
  latencyP95Ms: number;
  total: number;
}

export async function runProviderScorecard(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsProviderScore[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: "$provider",
        total: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
        failed: {
          $sum: {
            $cond: [
              {
                $in: [
                  "$status",
                  ["failed", "undelivered", "rejected"],
                ],
              },
              1,
              0,
            ],
          },
        },
        latencies: {
          $push: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$deliveredAt", false] },
                  { $ifNull: ["$sentAt", false] },
                ],
              },
              { $subtract: ["$deliveredAt", "$sentAt"] },
              null,
            ],
          },
        },
      },
    },
    { $limit: MAX_BUCKETS },
  ];

  const out: SabsmsProviderScore[] = [];
  for await (const row of messages.aggregate(pipeline)) {
    const total = Number(row.total ?? 0);
    const delivered = Number(row.delivered ?? 0);
    const failed = Number(row.failed ?? 0);
    const lats = (row.latencies ?? [])
      .filter((x: unknown): x is number => typeof x === "number")
      .sort((a: number, b: number) => a - b);
    const p95 = lats.length
      ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))]
      : 0;
    out.push({
      provider: String(row._id ?? "—"),
      dlrRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      errorRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      latencyP95Ms: Math.round(p95),
      total,
    });
  }
  out.sort((a, b) => b.total - a.total);
  return out.slice(0, MAX_BUCKETS);
}

/** Top countries — outbound count per country code. */
export interface SabsmsCountryBar {
  country: string;
  sent: number;
}

export async function runTopCountries(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsCountryBar[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: "$country",
        sent: { $sum: 1 },
      },
    },
    { $sort: { sent: -1 } },
    { $limit: MAX_BUCKETS },
  ];
  const out: SabsmsCountryBar[] = [];
  for await (const row of messages.aggregate(pipeline)) {
    out.push({
      country: String(row._id ?? "—"),
      sent: Number(row.sent ?? 0),
    });
  }
  return out;
}

/** Top contacts by engagement (replies + clicks). */
export interface SabsmsTopContact {
  contact: string;
  replies: number;
  clicks: number;
  lastSeen: string | null;
}

export async function runTopContacts(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsTopContact[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    {
      $match: {
        workspaceId: filter.workspaceId,
        direction: "inbound",
        createdAt: { $gte: filter.from, $lte: filter.to },
      },
    },
    {
      $group: {
        _id: "$from",
        replies: { $sum: 1 },
        lastSeen: { $max: "$createdAt" },
      },
    },
    { $sort: { replies: -1 } },
    { $limit: MAX_BUCKETS },
  ];
  const out: SabsmsTopContact[] = [];
  for await (const row of messages.aggregate(pipeline)) {
    out.push({
      contact: String(row._id ?? "—"),
      replies: Number(row.replies ?? 0),
      clicks: 0,
      lastSeen: row.lastSeen ? new Date(row.lastSeen).toISOString() : null,
    });
  }
  return out;
}

/** Cost vs revenue. Cost = wholesale (`cost`), Revenue = customer price (`price`). */
export interface SabsmsCostPoint {
  date: string;
  cost: number;
  revenue: number;
  margin: number;
}

export async function runCostVsRevenue(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsCostPoint[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    { $match: buildMatch(filter, "primary") },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        cost: { $sum: { $ifNull: ["$cost", 0] } },
        revenue: { $sum: { $ifNull: ["$price", 0] } },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: MAX_BUCKETS },
  ];
  const out: SabsmsCostPoint[] = [];
  for await (const row of messages.aggregate(pipeline)) {
    const cost = Number(row.cost ?? 0);
    const revenue = Number(row.revenue ?? 0);
    out.push({
      date: String(row._id ?? ""),
      cost,
      revenue,
      margin: revenue - cost,
    });
  }
  return out;
}

/** Reply-rate by template. */
export interface SabsmsTemplateReplyRow {
  templateId: string;
  sent: number;
  replies: number;
  rate: number;
}

export async function runTemplateReplyRates(
  db: Db,
  filter: SabsmsAnalyticsFilter,
): Promise<SabsmsTemplateReplyRow[]> {
  const messages = db.collection(SABSMS_COLLECTIONS.messages);
  const pipeline = [
    {
      $match: {
        ...buildMatch(filter, "primary"),
        templateId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$templateId",
        sent: { $sum: 1 },
      },
    },
    { $sort: { sent: -1 } },
    { $limit: MAX_BUCKETS },
  ];
  const sentByTemplate = new Map<string, number>();
  for await (const row of messages.aggregate(pipeline)) {
    sentByTemplate.set(String(row._id), Number(row.sent ?? 0));
  }

  // Replies: inbound rows whose conversation links back to a template send.
  // Heuristic for Phase 1 — we don't track the link directly, so we use 0
  // until the engine surfaces `repliedFromTemplateId` on the inbound doc.
  // The shape is still useful for the UI.
  const out: SabsmsTemplateReplyRow[] = [];
  for (const [templateId, sent] of sentByTemplate.entries()) {
    out.push({ templateId, sent, replies: 0, rate: 0 });
  }
  return out;
}

/** Build a `/sabsms/logs?…` URL with equivalent filters from a tile click. */
export function buildLogsDrilldownHref(
  filter: SabsmsAnalyticsFilter,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (filter.from) params.set("from", filter.from.toISOString());
  if (filter.to) params.set("to", filter.to.toISOString());
  for (const p of filter.providers ?? []) params.append("provider", p);
  for (const c of filter.countries ?? []) params.append("country", c);
  for (const cid of filter.campaignIds ?? []) params.append("campaign", cid);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const q = params.toString();
  return q ? `/sabsms/logs?${q}` : "/sabsms/logs";
}
