"use server";

/**
 * Drips (journeys) list — server actions (V2.9).
 *
 * `/sabsms/drips` is backed by `sabsms_journeys` + `sabsms_journey_runs`
 * (the V2.9 executor collections). Workspace scope is always resolved
 * from `getCachedSession()`; the client passes filters and ids only.
 *
 * Includes the Pinpoint importer action: parse the export (pure
 * `@/lib/sabsms/import/pinpoint`), create template drafts for every SMS
 * activity, swap the `ref:<n>` placeholders for the real template ids,
 * and insert the journey as a draft.
 */

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { parsePinpointJourney, TEMPLATE_REF_PREFIX } from "@/lib/sabsms/import/pinpoint";
import { createMongoJourneyStore, ensureJourneyIndexes } from "@/lib/sabsms/journeys/store";
import { startJourneyRun } from "@/lib/sabsms/journeys/triggers";
import {
  emptyJourneyStats,
  LIVE_RUN_STATUSES,
  SABSMS_JOURNEYS_COLLECTION,
  SABSMS_JOURNEY_RUNS_COLLECTION,
  type JourneyStats,
  type JourneyStatus,
  type SabsmsJourney,
} from "@/lib/sabsms/journeys/types";
import { extractVariables } from "@/lib/sabsms/render";

// ─── Types ────────────────────────────────────────────────────────────────

export interface JourneyListFilters {
  q?: string;
  status?: JourneyStatus | "all";
  sort?: "newest" | "oldest" | "name" | "active_runs";
}

export interface JourneyRow {
  id: string;
  name: string;
  status: JourneyStatus;
  triggerKind: SabsmsJourney["trigger"]["kind"];
  triggerLabel: string;
  stepCount: number;
  sendCount: number;
  branchCount: number;
  hasAb: boolean;
  winnerCount: number;
  activeRuns: number;
  stats: JourneyStats;
  updatedAt: string;
}

export type DripActionResult<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

const TRIGGER_LABELS: Record<SabsmsJourney["trigger"]["kind"], string> = {
  manual: "Manual",
  contact_added: "Contact added",
  inbound_keyword: "Inbound keyword",
  campaign_completed: "Campaign completed",
};

function toRow(doc: SabsmsJourney, activeRuns: number): JourneyRow {
  const steps = doc.steps ?? [];
  return {
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    triggerKind: doc.trigger.kind,
    triggerLabel:
      doc.trigger.kind === "inbound_keyword"
        ? `Keyword "${doc.trigger.keyword}"`
        : TRIGGER_LABELS[doc.trigger.kind],
    stepCount: steps.length,
    sendCount: steps.filter((s) => s.kind === "send").length,
    branchCount: steps.filter((s) => s.kind === "branch" || s.kind === "waitUntil").length,
    hasAb: steps.some((s) => s.kind === "send" && (s.abVariants?.length ?? 0) >= 2),
    winnerCount: Object.keys(doc.ab?.winners ?? {}).length,
    activeRuns,
    stats: doc.stats ?? emptyJourneyStats(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function loadJourneys(
  workspaceId: string,
  filters: JourneyListFilters = {},
): Promise<JourneyRow[]> {
  // "use server" exports are network-callable — never trust the passed
  // workspace id, even though the page resolves it from the session too.
  const ws = await resolveWorkspace();
  if (!ws.ok || ws.workspaceId !== workspaceId) return [];

  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);
  const col = db.collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION);

  const query: Record<string, unknown> = { workspaceId };
  if (filters.status && filters.status !== "all") query.status = filters.status;
  else query.status = { $ne: "archived" };
  if (filters.q?.trim()) {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.name = { $regex: escape(filters.q.trim()), $options: "i" };
  }

  let sort: Record<string, 1 | -1> = { updatedAt: -1 };
  if (filters.sort === "oldest") sort = { createdAt: 1 };
  if (filters.sort === "name") sort = { name: 1 };

  const docs = await col.find(query as never).sort(sort).limit(250).toArray();

  // Live-run counts in one aggregation, not N queries.
  const counts = await db
    .collection(SABSMS_JOURNEY_RUNS_COLLECTION)
    .aggregate<{ _id: string; n: number }>([
      { $match: { workspaceId, status: { $in: LIVE_RUN_STATUSES } } },
      { $group: { _id: "$journeyId", n: { $sum: 1 } } },
    ])
    .toArray();
  const byJourney = new Map(counts.map((c) => [c._id, c.n]));

  let rows = docs.map((d) => toRow(d, byJourney.get(String(d._id)) ?? 0));
  if (filters.sort === "active_runs") rows = rows.sort((a, b) => b.activeRuns - a.activeRuns);
  return rows;
}

// ─── Status mutations (list surface) ──────────────────────────────────────

export async function setJourneyStatusFromList(
  id: string,
  to: Extract<JourneyStatus, "active" | "paused" | "archived">,
): Promise<DripActionResult> {
  // Activation must pass through the validation gate in [id]/actions.
  const { activateJourney, pauseJourney, archiveJourney } = await import("./[id]/actions");
  const res =
    to === "active"
      ? await activateJourney(id)
      : to === "paused"
        ? await pauseJourney(id)
        : await archiveJourney(id);
  if (!res.ok) {
    return {
      ok: false,
      error: res.errors?.length ? `Fix before activating: ${res.errors[0]}` : res.error,
    };
  }
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

export async function duplicateJourney(
  id: string,
): Promise<DripActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };
  const { db } = await connectToDatabase();
  const col = db.collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION);
  const doc = await col.findOne({ _id: new ObjectId(id), workspaceId: ws.workspaceId } as never);
  if (!doc) return { ok: false, error: "not_found" };

  const now = new Date();
  const newId = new ObjectId();
  const { _id: _drop, ab: _abDrop, ...rest } = doc;
  await col.insertOne({
    ...rest,
    _id: newId,
    name: `${doc.name} (copy)`,
    status: "draft",
    stats: emptyJourneyStats(),
    ...(doc.ab?.sampleThreshold ? { ab: { sampleThreshold: doc.ab.sampleThreshold } } : {}),
    createdAt: now,
    updatedAt: now,
  } as SabsmsJourney);
  revalidatePath("/sabsms/drips");
  return { ok: true, id: String(newId) };
}

/** Manual enrolment from the list (suppression + dedupe inside). */
export async function enrolContactFromList(
  journeyId: string,
  phone: string,
): Promise<DripActionResult<{ runId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(journeyId)) return { ok: false, error: "invalid_id" };
  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);

  const owned = await db
    .collection(SABSMS_JOURNEYS_COLLECTION)
    .findOne(
      { _id: new ObjectId(journeyId), workspaceId: ws.workspaceId },
      { projection: { _id: 1 } },
    );
  if (!owned) return { ok: false, error: "not_found" };

  const store = createMongoJourneyStore(db);
  const res = await startJourneyRun(store, journeyId, { phone: phone.trim() });
  if (!res.started) return { ok: false, error: res.reason };
  revalidatePath("/sabsms/drips");
  return { ok: true, runId: res.runId };
}

// ─── Pinpoint import ──────────────────────────────────────────────────────

export interface PinpointImportSummary {
  journeyId: string;
  journeyName: string;
  stepCount: number;
  templatesCreated: number;
  warnings: string[];
}

export async function importPinpointJourneyAction(
  jsonText: string,
): Promise<DripActionResult<{ summary: PinpointImportSummary }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  let parsed: ReturnType<typeof parsePinpointJourney>;
  try {
    parsed = parsePinpointJourney(jsonText);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);
  const templatesCol = db.collection("sabsms_templates");
  const now = new Date();

  // Create one template draft per SMS activity; `{workspaceId, name}` is
  // unique, so collisions get a numeric suffix.
  const refToId = new Map<string, string>();
  for (const tpl of parsed.templates) {
    let inserted: ObjectId | null = null;
    for (let attempt = 0; attempt < 20 && !inserted; attempt++) {
      const name = attempt === 0 ? tpl.name : `${tpl.name} (${attempt + 1})`;
      try {
        const res = await templatesCol.insertOne({
          workspaceId: ws.workspaceId,
          name,
          category: "marketing",
          bodies: [{ locale: "en", body: tpl.body }],
          variables: extractVariables(tpl.body).named,
          status: "draft",
          reviewerNotes: "Imported from AWS Pinpoint journey export.",
          createdAt: now,
          updatedAt: now,
        });
        inserted = res.insertedId;
      } catch (e) {
        if ((e as { code?: number })?.code === 11000) continue; // name taken — suffix and retry
        throw e;
      }
    }
    if (!inserted) return { ok: false, error: "template_name_conflict" };
    refToId.set(tpl.ref, String(inserted));
  }

  // Swap ref placeholders for real template ids.
  const steps = parsed.journey.steps.map((step) => {
    if (step.kind !== "send") return step;
    const real = step.templateId.startsWith(TEMPLATE_REF_PREFIX)
      ? refToId.get(step.templateId)
      : undefined;
    return { ...step, templateId: real ?? step.templateId };
  });

  const journeyId = new ObjectId();
  await db.collection(SABSMS_JOURNEYS_COLLECTION).insertOne({
    _id: journeyId,
    workspaceId: ws.workspaceId,
    ...parsed.journey,
    steps,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/sabsms/drips");
  return {
    ok: true,
    summary: {
      journeyId: String(journeyId),
      journeyName: parsed.journey.name,
      stepCount: steps.length,
      templatesCreated: parsed.templates.length,
      warnings: parsed.warnings,
    },
  };
}
