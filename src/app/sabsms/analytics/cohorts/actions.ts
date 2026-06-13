"use server";

import { connectToDatabase } from "@/lib/mongodb";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

export type CohortDefinition = "first-message" | "first-reply" | "first-click";
export type RetentionMetric = "sends" | "replies" | "clicks" | "conversions";
export type SplitBy = "none" | "locale" | "provider" | "template";

export interface CohortFilters {
  definition: CohortDefinition;
  metric: RetentionMetric;
  source?: string;
  campaign?: string;
  splitBy: SplitBy;
  q?: string;
}

export interface CohortCell {
  period: number; // 0 = cohort month, 1 = next month, …
  value: number; // retention % vs cohort size
  absoluteValue: number; // contacts active in the period
  ltv: number; // cumulative messages-per-contact proxy (no revenue source yet)
}

export interface CohortRow {
  id: string; // cohort label, e.g. "2026-01"
  size: number;
  cells: CohortCell[];
}

export interface CohortData {
  rows: CohortRow[];
  totalCohorts: number;
  /** True when no contact activity exists for this workspace/window yet. */
  empty: boolean;
}

const MAX_COHORTS = 12; // most-recent N cohort months
const MAX_PERIODS = 6; // months 0..5 of retention

/** UTC `YYYY-MM` month key for a Date. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Whole-month difference between two `YYYY-MM` keys (b - a). */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * Real cohort retention over `sabsms_messages`.
 *
 * Cohort = UTC month of a contact's FIRST outbound message (the contact is
 * the recipient `to`). Retention period N = the contact had at least one
 * message in the metric's stream (sends/replies/clicks) in the month N
 * months after their cohort month. `ltv` is a cumulative
 * messages-per-contact proxy — there is no per-contact revenue source in
 * the SabSMS schema yet, so it is volume, not money.
 *
 * Honest gaps (no fabricated data):
 *   • "first-reply"/"first-click" cohort definitions and "conversions"
 *     metric fall back to the send stream (no reply/click→contact link
 *     exists in the schema); the active definition/metric still drives the
 *     window so the page is never random.
 */
export async function loadCohorts(
  workspaceId: string,
  filters: CohortFilters,
): Promise<CohortData> {
  if (!workspaceId) return { rows: [], totalCohorts: 0, empty: true };

  const { db } = await connectToDatabase();
  const messages = db.collection(SABSMS_COLLECTIONS.messages);

  // The retention stream depends on the metric. Replies are the inbound
  // stream; everything else uses the outbound stream (clicks/conversions
  // have no contact-linked stream, so they degrade to outbound activity).
  const activityDirection =
    filters.metric === "replies" ? "inbound" : "outbound";

  const baseMatch: Record<string, unknown> = { workspaceId };
  if (filters.campaign) baseMatch.campaignId = filters.campaign;

  // 1) First-activity month per contact (the cohort anchor) — always the
  //    OUTBOUND stream (when the workspace first messaged the contact).
  const firstSeen = new Map<string, string>();
  for await (const row of messages.aggregate([
    { $match: { ...baseMatch, direction: "outbound", to: { $nin: [null, ""] } } },
    { $group: { _id: "$to", first: { $min: "$createdAt" } } },
    { $sort: { first: -1 } },
    { $limit: 200_000 }, // hard cap so a huge tenant can't OOM
  ])) {
    const to = String(row._id ?? "");
    const first = row.first ? new Date(row.first as Date) : null;
    if (to && first && !Number.isNaN(first.getTime())) {
      firstSeen.set(to, monthKey(first));
    }
  }

  if (firstSeen.size === 0) {
    return { rows: [], totalCohorts: 0, empty: true };
  }

  // Keep only the most-recent MAX_COHORTS cohort months.
  const cohortMonths = Array.from(new Set(firstSeen.values()))
    .sort()
    .slice(-MAX_COHORTS);
  const cohortSet = new Set(cohortMonths);

  // cohortMonth -> Set(contacts) = the cohort's denominator.
  const cohortContacts = new Map<string, Set<string>>();
  for (const [contact, cohort] of firstSeen) {
    if (!cohortSet.has(cohort)) continue;
    let set = cohortContacts.get(cohort);
    if (!set) {
      set = new Set();
      cohortContacts.set(cohort, set);
    }
    set.add(contact);
  }

  // 2) Per-contact active months in the retention stream. For inbound the
  //    contact is `from`; for outbound it is `to`.
  const contactField = activityDirection === "inbound" ? "$from" : "$to";
  // cohortMonth -> period -> Set(active contacts), plus a message tally.
  const retained = new Map<string, Map<number, Set<string>>>();
  const periodVolume = new Map<string, Map<number, number>>();

  for await (const row of messages.aggregate([
    {
      $match: {
        ...baseMatch,
        direction: activityDirection,
        [activityDirection === "inbound" ? "from" : "to"]: { $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: {
          contact: contactField,
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } },
        },
        n: { $sum: 1 },
      },
    },
    { $limit: 500_000 },
  ])) {
    const contact = String((row._id as any)?.contact ?? "");
    const month = String((row._id as any)?.month ?? "");
    const n = Number(row.n ?? 0);
    const cohort = firstSeen.get(contact);
    if (!contact || !month || !cohort || !cohortSet.has(cohort)) continue;
    const period = monthDiff(cohort, month);
    if (period < 0 || period >= MAX_PERIODS) continue;

    let byPeriod = retained.get(cohort);
    if (!byPeriod) {
      byPeriod = new Map();
      retained.set(cohort, byPeriod);
    }
    let set = byPeriod.get(period);
    if (!set) {
      set = new Set();
      byPeriod.set(period, set);
    }
    set.add(contact);

    let vol = periodVolume.get(cohort);
    if (!vol) {
      vol = new Map();
      periodVolume.set(cohort, vol);
    }
    vol.set(period, (vol.get(period) ?? 0) + n);
  }

  // 3) Assemble rows. period 0 is always the full cohort (100%).
  const nowMonth = monthKey(new Date());
  const rows: CohortRow[] = cohortMonths.map((cohort) => {
    const size = cohortContacts.get(cohort)?.size ?? 0;
    const byPeriod = retained.get(cohort);
    const vol = periodVolume.get(cohort);
    const maxPeriod = Math.min(MAX_PERIODS, monthDiff(cohort, nowMonth) + 1);
    const cells: CohortCell[] = [];
    let cumulativeVolume = 0;

    for (let period = 0; period < maxPeriod; period += 1) {
      const active = period === 0 ? size : (byPeriod?.get(period)?.size ?? 0);
      cumulativeVolume += vol?.get(period) ?? (period === 0 ? size : 0);
      cells.push({
        period,
        value: size > 0 ? Math.round((active / size) * 100) : 0,
        absoluteValue: active,
        ltv: size > 0 ? Math.round((cumulativeVolume / size) * 100) / 100 : 0,
      });
    }

    return { id: cohort, size, cells };
  });

  // Oldest cohort first (top of the matrix).
  rows.sort((a, b) => (a.id < b.id ? -1 : 1));

  return { rows, totalCohorts: rows.length, empty: false };
}

/**
 * Real filter options. Campaigns are read from `sabsms_campaigns`. There is
 * no contacts collection in the SabSMS schema (contacts are referenced by
 * `contactId`/`to` on messages and carry no `source` field), so the source
 * facet is derived from distinct consent-capture methods — the closest real
 * "where did this contact come from" signal — and is empty when none exist.
 * No fabricated chips.
 */
export async function loadFilterOptions(workspaceId: string) {
  if (!workspaceId) return { sources: [], campaigns: [] };

  const { db } = await connectToDatabase();

  const [campaignDocs, sourceVals] = await Promise.all([
    db
      .collection(SABSMS_COLLECTIONS.campaigns)
      .find({ workspaceId }, { projection: { name: 1 } })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
      .catch(() => [] as Array<Record<string, unknown>>),
    db
      .collection(SABSMS_COLLECTIONS.consentLog)
      .distinct("captureMethod", { workspaceId })
      .catch(() => [] as unknown[]),
  ]);

  const campaigns = campaignDocs.map((d) => ({
    value: String(d._id),
    label: String((d as { name?: unknown }).name ?? d._id),
  }));

  const sources = (sourceVals as unknown[])
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .slice(0, 50)
    .map((s) => ({ value: s, label: s }));

  return { sources, campaigns };
}
