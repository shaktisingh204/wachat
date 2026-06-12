"use server";

/**
 * SabSMS A/B tests — server actions.
 *
 * Page 14 of `plans/sabsms-pages-catalog.md` §B.2. The 20 unique features
 * land here:
 *  • List active tests + variant data (loadAbTests)
 *  • Statistical significance (re-exported from `./significance` — pure)
 *  • Auto-promote winner toggle (setAutoPromote)
 *  • Min-sample threshold (setMinSample)
 *  • Conversion metric picker (setConversionMetric)
 *  • Stop test early (stopTest)
 *  • Force-pick winner (forcePickWinner)
 *  • Clone (cloneTest)
 *  • Schedule next (scheduleNextTest)
 *  • Bayesian vs frequentist toggle (setStatsMode)
 *  • Audit trail (recordAudit + loadAuditLog)
 *  • Export raw event log (exportEventLog returns CSV text)
 *
 * Everything is workspace-scoped via `getCachedSession()`. Mongo touches
 * go through `connectToDatabase()`. Two ad-hoc collections — `sabsms_ab_tests`
 * and `sabsms_ab_audit` — are written-on-first-use; no schema migration
 * is needed for the Phase-1 demo.
 *
 * Stubs:
 *  • The audit collection is best-effort: failures fall back to
 *    `console.warn` so the UI keeps moving.
 *  • Engine `stopAbTest` / `pickWinner` endpoints are not yet exposed on
 *    `sabsmsEngine`; we set a status flag in Mongo as a forward-compatible
 *    shim and document the TODO inline.
 */

import { randomUUID } from "node:crypto";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

import {
  computeSegmentLifts as _computeSegmentLifts,
  computeSignificance as _computeSignificance,
  simulateSeries,
  type AbConversionMetric,
  type AbStatsMode,
  type AbTestRow,
  type AbVariant,
} from "./significance";

// Re-export pure helpers + types so callers can keep importing from
// `./actions` while the tests load `./significance` directly.
export type {
  AbConversionMetric,
  AbStatsMode,
  AbTestKind,
  AbTestRow,
  AbTestStatus,
  AbVariant,
  SegmentLift,
  SignificanceResult,
} from "./significance";

/**
 * Pure stats — re-exposed so the page imports a single module surface
 * (`from "./actions"`). The implementation lives in `./significance` so
 * unit tests can load it without the Mongo runtime in tow.
 */
export async function computeSignificance(
  controlConversions: number,
  controlTotal: number,
  variantConversions: number,
  variantTotal: number,
) {
  return _computeSignificance(
    controlConversions,
    controlTotal,
    variantConversions,
    variantTotal,
  );
}

export async function computeSegmentLifts(test: AbTestRow) {
  return _computeSegmentLifts(test);
}

export type ActionResult<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

export interface AbAuditEntry {
  id: string;
  testId: string;
  action: string;
  by?: string;
  at: string;
  meta?: Record<string, unknown>;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Load every A/B test for the workspace. Falls back to a stable in-memory
 * sample set when the collection is empty so the UI is meaningful on a
 * brand-new tenant (Phase-1 demo).
 */
export async function loadAbTests(workspaceId: string): Promise<AbTestRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection<Record<string, unknown>>("sabsms_ab_tests");
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  if (docs.length === 0) return seedTests();
  return docs.map(projectRow);
}

export async function loadAuditLog(
  workspaceId: string,
  testId: string,
): Promise<AbAuditEntry[]> {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<Record<string, unknown>>("sabsms_ab_audit");
    const docs = await col
      .find({ workspaceId, testId })
      .sort({ at: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id ?? d.id ?? randomUUID()),
      testId: String(d.testId ?? ""),
      action: String(d.action ?? "unknown"),
      by: d.by ? String(d.by) : undefined,
      at: d.at instanceof Date ? d.at.toISOString() : String(d.at ?? ""),
      meta: (d.meta as Record<string, unknown>) ?? undefined,
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[sabsms/ab-tests] audit read failed", err);
    return [];
  }
}

function projectRow(doc: Record<string, unknown>): AbTestRow {
  const variants = Array.isArray(doc.variants)
    ? (doc.variants as AbVariant[])
    : [];
  return {
    id: String(doc._id ?? doc.id ?? randomUUID()),
    name: String(doc.name ?? "Untitled test"),
    kind: (doc.kind as AbTestRow["kind"]) ?? "body",
    status: (doc.status as AbTestRow["status"]) ?? "running",
    metric: (doc.metric as AbConversionMetric) ?? "ctr",
    statsMode: (doc.statsMode as AbStatsMode) ?? "frequentist",
    autoPromote: Boolean(doc.autoPromote),
    minSample: typeof doc.minSample === "number" ? doc.minSample : 1000,
    variants,
    winnerVariantId: doc.winnerVariantId
      ? String(doc.winnerVariantId)
      : undefined,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt ?? new Date().toISOString()),
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : String(doc.updatedAt ?? new Date().toISOString()),
    startedAt:
      doc.startedAt instanceof Date ? doc.startedAt.toISOString() : undefined,
    completedAt:
      doc.completedAt instanceof Date
        ? doc.completedAt.toISOString()
        : undefined,
    simulation: Array.isArray(doc.simulation)
      ? (doc.simulation as { iter: number; pValue: number }[])
      : undefined,
  };
}

/**
 * Seed data — keeps the empty-state useful and gives the page real
 * numbers to render in a fresh workspace. Exported for the page so it
 * can render the same fixture during server render *and* hydration.
 */
function seedTests(): AbTestRow[] {
  const now = new Date();
  const ago = (h: number) =>
    new Date(now.getTime() - h * 3600_000).toISOString();
  return [
    {
      id: "seed-promo-cta",
      name: "Promo CTA wording",
      kind: "body",
      status: "running",
      metric: "ctr",
      statsMode: "frequentist",
      autoPromote: false,
      minSample: 2000,
      variants: [
        {
          id: "ctrl",
          label: "Control — Shop now",
          total: 2410,
          conversions: 187,
          clicks: 187,
          replies: 22,
          costMicros: 24_100_000,
          segment: "loyal",
        },
        {
          id: "var-a",
          label: "B — Save 20% today",
          total: 2398,
          conversions: 241,
          clicks: 241,
          replies: 35,
          costMicros: 23_980_000,
          segment: "loyal",
        },
      ],
      simulation: simulateSeries(2400, 0.08, 0.1),
      createdAt: ago(96),
      updatedAt: ago(2),
      startedAt: ago(96),
    },
    {
      id: "seed-sender-id",
      name: "Sender ID rotation",
      kind: "sender",
      status: "running",
      metric: "reply",
      statsMode: "frequentist",
      autoPromote: true,
      minSample: 1500,
      variants: [
        {
          id: "ctrl",
          label: "Long code +1 415",
          total: 1820,
          conversions: 142,
          clicks: 0,
          replies: 142,
          costMicros: 18_200_000,
          segment: "us-west",
        },
        {
          id: "var-a",
          label: "Short code 78462",
          total: 1804,
          conversions: 196,
          clicks: 0,
          replies: 196,
          costMicros: 21_648_000,
          segment: "us-west",
        },
      ],
      simulation: simulateSeries(1800, 0.078, 0.109),
      createdAt: ago(168),
      updatedAt: ago(6),
      startedAt: ago(168),
    },
    {
      id: "seed-send-time",
      name: "Morning vs afternoon",
      kind: "send_time",
      status: "completed",
      metric: "conversion",
      statsMode: "bayesian",
      autoPromote: false,
      minSample: 5000,
      winnerVariantId: "var-a",
      variants: [
        {
          id: "ctrl",
          label: "9am local",
          total: 5104,
          conversions: 392,
          clicks: 470,
          replies: 88,
          costMicros: 51_040_000,
        },
        {
          id: "var-a",
          label: "2pm local",
          total: 5101,
          conversions: 461,
          clicks: 522,
          replies: 102,
          costMicros: 51_010_000,
        },
      ],
      simulation: simulateSeries(5000, 0.077, 0.09),
      createdAt: ago(720),
      updatedAt: ago(72),
      startedAt: ago(720),
      completedAt: ago(72),
    },
  ];
}

// ─── Writes ───────────────────────────────────────────────────────────────

async function recordAudit(
  workspaceId: string,
  testId: string,
  action: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection("sabsms_ab_audit").insertOne({
      _id: randomUUID() as unknown as never,
      workspaceId,
      testId,
      action,
      at: new Date(),
      meta,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sabsms/ab-tests] audit write failed for ${testId}/${action}`,
      err,
    );
  }
}

async function patchTest(
  workspaceId: string,
  testId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const { db } = await connectToDatabase();
    await db.collection("sabsms_ab_tests").updateOne(
      { _id: testId as unknown as never, workspaceId },
      { $set: { ...patch, updatedAt: new Date() } },
      { upsert: false },
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to update test.",
    };
  }
}

export async function setAutoPromote(
  testId: string,
  value: boolean,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const res = await patchTest(ws.workspaceId, testId, { autoPromote: value });
  if (res.ok) await recordAudit(ws.workspaceId, testId, "autoPromote", { value });
  return res;
}

export async function setMinSample(
  testId: string,
  value: number,
): Promise<ActionResult> {
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: "Min-sample must be a non-negative number." };
  }
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const res = await patchTest(ws.workspaceId, testId, { minSample: value });
  if (res.ok) await recordAudit(ws.workspaceId, testId, "minSample", { value });
  return res;
}

export async function setConversionMetric(
  testId: string,
  metric: AbConversionMetric,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const res = await patchTest(ws.workspaceId, testId, { metric });
  if (res.ok) await recordAudit(ws.workspaceId, testId, "metric", { metric });
  return res;
}

export async function setStatsMode(
  testId: string,
  statsMode: AbStatsMode,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const res = await patchTest(ws.workspaceId, testId, { statsMode });
  if (res.ok)
    await recordAudit(ws.workspaceId, testId, "statsMode", { statsMode });
  return res;
}

export async function stopTest(testId: string): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  // TODO: route this to a future `sabsmsEngine.stopAbTest()` once the
  // engine exposes one. For now we mark Mongo + audit-log.
  const res = await patchTest(ws.workspaceId, testId, {
    status: "completed",
    completedAt: new Date(),
  });
  if (res.ok) await recordAudit(ws.workspaceId, testId, "stop");
  return res;
}

export async function forcePickWinner(
  testId: string,
  variantId: string,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const res = await patchTest(ws.workspaceId, testId, {
    winnerVariantId: variantId,
    status: "completed",
    completedAt: new Date(),
  });
  if (res.ok)
    await recordAudit(ws.workspaceId, testId, "forcePick", { variantId });
  return res;
}

export async function cloneTest(
  testId: string,
): Promise<ActionResult<{ newId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const { db } = await connectToDatabase();
    const col = db.collection<Record<string, unknown>>("sabsms_ab_tests");
    const source = await col.findOne({
      _id: testId as unknown as never,
      workspaceId: ws.workspaceId,
    });
    const seed = source ?? seedTests().find((t) => t.id === testId);
    if (!seed) return { ok: false, error: "Test not found." };

    const newId = randomUUID();
    const now = new Date();
    await col.insertOne({
      _id: newId as unknown as never,
      workspaceId: ws.workspaceId,
      name: `${(seed as { name?: string }).name ?? "Test"} (clone)`,
      kind: (seed as { kind?: string }).kind ?? "body",
      status: "running",
      metric: (seed as { metric?: string }).metric ?? "ctr",
      statsMode: (seed as { statsMode?: string }).statsMode ?? "frequentist",
      autoPromote: false,
      minSample: (seed as { minSample?: number }).minSample ?? 1000,
      variants: ((seed as { variants?: AbVariant[] }).variants ?? []).map(
        (v) => ({
          ...v,
          total: 0,
          conversions: 0,
          clicks: 0,
          replies: 0,
          costMicros: 0,
        }),
      ),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    });
    await recordAudit(ws.workspaceId, newId, "clone", { from: testId });
    return { ok: true, newId };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to clone test.",
    };
  }
}

export async function scheduleNextTest(
  testId: string,
  sendAt: string,
): Promise<ActionResult<{ scheduledId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const dt = new Date(sendAt);
  if (Number.isNaN(dt.getTime())) {
    return { ok: false, error: "Invalid date." };
  }
  try {
    const { db } = await connectToDatabase();
    const id = randomUUID();
    await db.collection("sabsms_ab_tests").insertOne({
      _id: id as unknown as never,
      workspaceId: ws.workspaceId,
      name: `Follow-up to ${testId}`,
      kind: "body",
      status: "running",
      metric: "ctr",
      statsMode: "frequentist",
      autoPromote: false,
      minSample: 1000,
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: dt,
      parentTestId: testId,
    });
    await recordAudit(ws.workspaceId, id, "scheduleNext", {
      sendAt: dt.toISOString(),
    });
    return { ok: true, scheduledId: id };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to schedule.",
    };
  }
}

/**
 * Export the raw per-variant event log as CSV text. The page wraps this
 * in `SabsmsExportMenu`'s `toCsv` slot so the browser triggers the
 * download — keeping the action body small and JSON-friendly.
 */
export async function exportEventLog(
  testId: string,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const tests = await loadAbTests(ws.workspaceId);
  const t = tests.find((x) => x.id === testId);
  if (!t) return { ok: false, error: "Test not found." };
  const header =
    "variantId,label,total,conversions,clicks,replies,costMicros,segment";
  const lines = t.variants.map((v) =>
    [
      v.id,
      JSON.stringify(v.label),
      v.total,
      v.conversions,
      v.clicks,
      v.replies,
      v.costMicros,
      v.segment ?? "",
    ].join(","),
  );
  return {
    ok: true,
    csv: [header, ...lines].join("\n"),
    filename: `ab-test-${testId}.csv`,
  };
}

// ─── V2.9 — Journey A/B steps ─────────────────────────────────────────────
//
// Journeys carry their own A/B arms (`steps[].abVariants` with
// deterministic assignment + auto-winner promotion in
// `@/lib/sabsms/journeys/ab`). This section surfaces every journey A/B
// step — running or already promoted — with per-variant stats from run
// history + message-tag aggregation.

export interface JourneyAbVariantRow {
  templateId: string;
  templateName: string;
  weight: number;
  sent: number;
  delivered: number;
  replied: number;
  clicked: number;
  replyRate: number;
  clickRate: number;
  isWinner: boolean;
}

export interface JourneyAbRow {
  journeyId: string;
  journeyName: string;
  journeyStatus: string;
  stepId: string;
  stepIndex: number;
  sampleThreshold: number;
  variants: JourneyAbVariantRow[];
  winner?: {
    templateId: string;
    templateName: string;
    metric: "reply" | "click";
    rate: number;
    samples: number;
    decidedAtIso: string;
    note: string;
  };
}

export async function loadJourneyAbRows(): Promise<JourneyAbRow[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];

  const { connectToDatabase: connect } = await import("@/lib/mongodb");
  const { db } = await connect();
  const { createMongoJourneyStore } = await import("@/lib/sabsms/journeys/store");
  const { DEFAULT_AB_SAMPLE_THRESHOLD } = await import("@/lib/sabsms/journeys/ab");
  const { SABSMS_JOURNEYS_COLLECTION } = await import("@/lib/sabsms/journeys/types");

  const store = createMongoJourneyStore(db);
  const journeys = await db
    .collection(SABSMS_JOURNEYS_COLLECTION)
    .find({
      workspaceId: ws.workspaceId,
      $or: [
        { "steps.abVariants.1": { $exists: true } },
        { "ab.winners": { $exists: true, $ne: {} } },
      ],
    })
    .limit(100)
    .toArray();

  // Template id → name lookup for labels.
  const templateNames = new Map<string, string>();
  const tplDocs = await db
    .collection("sabsms_templates")
    .find({ workspaceId: ws.workspaceId })
    .project({ name: 1 })
    .limit(500)
    .toArray();
  for (const t of tplDocs) templateNames.set(String(t._id), (t as { name?: string }).name ?? "");
  const nameOf = (id: string) => templateNames.get(id) || `Template ${id.slice(-6)}`;

  const rows: JourneyAbRow[] = [];
  for (const j of journeys) {
    const journey = j as unknown as import("@/lib/sabsms/journeys/types").SabsmsJourney;
    const winners = journey.ab?.winners ?? {};
    const threshold = journey.ab?.sampleThreshold ?? DEFAULT_AB_SAMPLE_THRESHOLD;

    for (let i = 0; i < journey.steps.length; i++) {
      const step = journey.steps[i];
      if (step.kind !== "send") continue;
      const winner = winners[step.id];
      const arms = step.abVariants ?? [];
      if (arms.length < 2 && !winner) continue;

      // Promoted steps lose `abVariants` — reconstruct arms from the
      // recorded stats so the page still shows the full comparison.
      const variantIds =
        arms.length >= 2
          ? arms.map((a) => a.templateId)
          : Array.from(
              new Set([
                step.templateId,
                ...(winner ? [winner.templateId] : []),
              ]),
            );
      const stats = await store.collectVariantStats(String(journey._id), step.id, variantIds);
      const byId = new Map(stats.map((s) => [s.templateId, s]));

      rows.push({
        journeyId: String(journey._id),
        journeyName: journey.name,
        journeyStatus: journey.status,
        stepId: step.id,
        stepIndex: i,
        sampleThreshold: threshold,
        variants: variantIds.map((id) => {
          const s = byId.get(id);
          const sent = s?.sent ?? 0;
          return {
            templateId: id,
            templateName: nameOf(id),
            weight: arms.find((a) => a.templateId === id)?.weight ?? 1,
            sent,
            delivered: s?.delivered ?? 0,
            replied: s?.replied ?? 0,
            clicked: s?.clicked ?? 0,
            replyRate: sent > 0 ? (s?.replied ?? 0) / sent : 0,
            clickRate: sent > 0 ? (s?.clicked ?? 0) / sent : 0,
            isWinner: winner?.templateId === id,
          };
        }),
        ...(winner
          ? {
              winner: {
                templateId: winner.templateId,
                templateName: nameOf(winner.templateId),
                metric: winner.metric,
                rate: winner.rate,
                samples: winner.samples,
                decidedAtIso: new Date(winner.decidedAt).toISOString(),
                note: winner.note,
              },
            }
          : {}),
      });
    }
  }
  return rows;
}

/**
 * Manual "promote now" for a journey A/B step — same math as the
 * automatic sweep; `force` skips the sample gate.
 */
export async function promoteJourneyWinnerAction(
  journeyId: string,
  stepId: string,
  force = false,
): Promise<ActionResult<{ templateId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const { connectToDatabase: connect } = await import("@/lib/mongodb");
  const { db } = await connect();
  const { ObjectId: OID } = await import("mongodb");
  if (!OID.isValid(journeyId)) return { ok: false, error: "invalid_id" };

  const { SABSMS_JOURNEYS_COLLECTION } = await import("@/lib/sabsms/journeys/types");
  const doc = await db
    .collection(SABSMS_JOURNEYS_COLLECTION)
    .findOne({ _id: new OID(journeyId), workspaceId: ws.workspaceId });
  if (!doc) return { ok: false, error: "not_found" };

  const { createMongoJourneyStore } = await import("@/lib/sabsms/journeys/store");
  const { maybePromoteWinner } = await import("@/lib/sabsms/journeys/ab");
  const store = createMongoJourneyStore(db);
  const res = await maybePromoteWinner(
    store,
    doc as unknown as import("@/lib/sabsms/journeys/types").SabsmsJourney,
    stepId,
    { force },
  );
  if (!res.promoted) {
    const messages: Record<string, string> = {
      no_ab: "This step has no A/B variants.",
      already_promoted: "A winner is already promoted.",
      insufficient_sample: "Not enough sends per variant yet.",
      no_signal: "No replies or clicks to decide on yet.",
      not_found: "Step not found.",
    };
    return { ok: false, error: messages[res.reason] ?? res.reason };
  }
  const { revalidatePath: revalidate } = await import("next/cache");
  revalidate("/sabsms/ab-tests");
  revalidate(`/sabsms/drips/${journeyId}`);
  return { ok: true, templateId: res.winner.templateId };
}
