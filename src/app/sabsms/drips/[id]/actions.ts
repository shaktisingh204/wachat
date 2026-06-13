"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * Journey builder — server actions (V2.9).
 *
 * Workspace scope always comes from `getCachedSession()`; the client
 * only ever passes journey ids + drafts, and every Mongo touch filters
 * by `{ _id, workspaceId }` so a stolen id cannot cross tenants.
 *
 * Activation refuses invalid drafts (`validateJourney`), so the
 * executor can assume structural integrity for active journeys.
 */

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { createMongoJourneyStore, ensureJourneyIndexes } from "@/lib/sabsms/journeys/store";
import { startJourneyRun } from "@/lib/sabsms/journeys/triggers";
import {
  emptyJourneyStats,
  JourneyStepSchema,
  JourneyTriggerSchema,
  SABSMS_JOURNEYS_COLLECTION,
  type JourneyAbWinner,
  type JourneyStats,
  type JourneyStatus,
  type SabsmsJourney,
} from "@/lib/sabsms/journeys/types";

import { validateJourney, type JourneyDraft } from "./validate";

export type JourneyActionResult<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; errors?: string[] };

export interface JourneyDetail {
  id: string;
  name: string;
  status: JourneyStatus;
  draft: JourneyDraft;
  stats: JourneyStats;
  winners: Record<string, JourneyAbWinner & { decidedAtIso: string }>;
  activeRuns: number;
  updatedAt: string;
}

export interface TemplateOption {
  value: string;
  label: string;
  body: string;
}

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: (await getSabsmsWorkspaceId()) ?? "" };
}

function toDraft(doc: SabsmsJourney): JourneyDraft {
  return {
    name: doc.name,
    trigger: doc.trigger,
    steps: doc.steps,
    exitRules: doc.exitRules ?? { onUnsubscribe: true },
    goal: doc.goal,
    abSampleThreshold: doc.ab?.sampleThreshold,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function loadJourneyDetail(
  id: string,
): Promise<JourneyActionResult<{ journey: JourneyDetail }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };

  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);
  const doc = await db
    .collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION)
    .findOne({ _id: new ObjectId(id), workspaceId: ws.workspaceId } as never);
  if (!doc) return { ok: false, error: "not_found" };

  const store = createMongoJourneyStore(db);
  const activeRuns = await store.countLiveRuns(id);

  const winners: JourneyDetail["winners"] = {};
  for (const [stepId, w] of Object.entries(doc.ab?.winners ?? {})) {
    winners[stepId] = { ...w, decidedAtIso: new Date(w.decidedAt).toISOString() };
  }

  return {
    ok: true,
    journey: {
      id: String(doc._id),
      name: doc.name,
      status: doc.status,
      draft: toDraft(doc),
      stats: doc.stats ?? emptyJourneyStats(),
      winners,
      activeRuns,
      updatedAt: new Date(doc.updatedAt).toISOString(),
    },
  };
}

/** Templates the send-step picker can choose from. */
export async function listJourneyTemplateOptions(): Promise<TemplateOption[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection("sabsms_templates")
    .find({ workspaceId: ws.workspaceId, deprecated: { $ne: true } })
    .project({ name: 1, bodies: 1 })
    .sort({ name: 1 })
    .limit(300)
    .toArray();
  return docs.map((d) => {
    const bodies = (d as { bodies?: Array<{ locale: string; body: string }> }).bodies ?? [];
    return {
      value: String(d._id),
      label: (d as unknown as { name?: string }).name ?? String(d._id),
      body: bodies.find((b) => b.locale === "en")?.body ?? bodies[0]?.body ?? "",
    };
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * Save a draft. `id === null` creates the journey (status `draft`).
 * Drafts may save with validation ERRORS (work-in-progress is fine) —
 * only activation is gated.
 */
export async function saveJourneyDraft(
  id: string | null,
  draft: JourneyDraft,
): Promise<JourneyActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  // Schema-level sanity (shape, not semantics) so garbage never lands.
  const stepsParse = JourneyStepSchema.array().safeParse(draft.steps ?? []);
  const triggerParse = JourneyTriggerSchema.safeParse(draft.trigger);
  if (!stepsParse.success || !triggerParse.success) {
    return { ok: false, error: "draft_shape_invalid" };
  }
  if (!draft.name?.trim()) return { ok: false, error: "Name is required" };

  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);
  const col = db.collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION);
  const now = new Date();

  const set: Partial<SabsmsJourney> = {
    name: draft.name.trim(),
    trigger: triggerParse.data,
    steps: stepsParse.data,
    exitRules: { onUnsubscribe: true, ...(draft.exitRules?.onReply ? { onReply: true } : {}) },
    updatedAt: now,
  };
  if (draft.goal) set.goal = draft.goal;

  if (id === null) {
    const _id = new ObjectId();
    await col.insertOne({
      _id,
      workspaceId: ws.workspaceId,
      status: "draft",
      stats: emptyJourneyStats(),
      ...(draft.abSampleThreshold ? { ab: { sampleThreshold: draft.abSampleThreshold } } : {}),
      createdAt: now,
      ...set,
    } as SabsmsJourney);
    revalidatePath("/sabsms/drips");
    return { ok: true, id: String(_id) };
  }

  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };
  const unset: Record<string, ""> = {};
  if (draft.abSampleThreshold) {
    (set as Record<string, unknown>)["ab.sampleThreshold"] = draft.abSampleThreshold;
  } else {
    unset["ab.sampleThreshold"] = "";
  }
  if (!draft.goal) unset.goal = "";

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const res = await col.updateOne(
    { _id: new ObjectId(id), workspaceId: ws.workspaceId } as never,
    update as never,
  );
  if (res.matchedCount === 0) return { ok: false, error: "not_found" };
  revalidatePath("/sabsms/drips");
  revalidatePath(`/sabsms/drips/${id}`);
  return { ok: true, id };
}

async function setStatus(
  id: string,
  from: JourneyStatus[],
  to: JourneyStatus,
): Promise<JourneyActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };
  const { db } = await connectToDatabase();
  const res = await db.collection(SABSMS_JOURNEYS_COLLECTION).updateOne(
    {
      _id: new ObjectId(id),
      workspaceId: ws.workspaceId,
      status: { $in: from },
    },
    { $set: { status: to, updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) return { ok: false, error: "not_found_or_wrong_state" };
  revalidatePath("/sabsms/drips");
  revalidatePath(`/sabsms/drips/${id}`);
  return { ok: true };
}

/** Activate — strict validation gate. */
export async function activateJourney(id: string): Promise<JourneyActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };

  const { db } = await connectToDatabase();
  const doc = await db
    .collection<SabsmsJourney>(SABSMS_JOURNEYS_COLLECTION)
    .findOne({ _id: new ObjectId(id), workspaceId: ws.workspaceId } as never);
  if (!doc) return { ok: false, error: "not_found" };

  const validation = validateJourney(toDraft(doc));
  if (!validation.ok) {
    return { ok: false, error: "validation_failed", errors: validation.errors };
  }
  return setStatus(id, ["draft", "paused"], "active");
}

export async function pauseJourney(id: string): Promise<JourneyActionResult> {
  return setStatus(id, ["active"], "paused");
}

export async function archiveJourney(id: string): Promise<JourneyActionResult> {
  return setStatus(id, ["draft", "active", "paused"], "archived");
}

/**
 * Test enrolment from the builder — works on drafts too so authors can
 * dry-run before going live (suppression + dedupe still apply).
 */
export async function testEnrolJourney(
  id: string,
  phone: string,
  vars?: Record<string, string>,
): Promise<JourneyActionResult<{ runId: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid_id" };

  const { db } = await connectToDatabase();
  await ensureJourneyIndexes(db);

  // Cross-tenant guard before delegating to the store helper.
  const owned = await db
    .collection(SABSMS_JOURNEYS_COLLECTION)
    .findOne(
      { _id: new ObjectId(id), workspaceId: ws.workspaceId },
      { projection: { _id: 1 } },
    );
  if (!owned) return { ok: false, error: "not_found" };

  const store = createMongoJourneyStore(db);
  const res = await startJourneyRun(store, id, { phone, vars }, { allowDraft: true });
  if (!res.started) return { ok: false, error: res.reason };
  revalidatePath(`/sabsms/drips/${id}`);
  return { ok: true, runId: res.runId };
}
