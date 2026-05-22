"use server";

/**
 * Drip builder — server actions.
 *
 * Backs Page 13 §B.2 of `plans/sabsms-pages-catalog.md` (`/sabsms/drips/[id]`).
 *
 * Workspace scope is always resolved from `getCachedSession()` — never
 * trusted from the client. Mutations go through `getSabsmsCollections()`
 * with a `{ workspaceId, _id }` filter so a stolen drip id from another
 * workspace can never be touched. Dry-runs and AI suggestions are stubs
 * that the engine can later proxy; the wire shape stays stable.
 */

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";

import {
  compileDripToSteps,
  validateDrip,
  type DraftDrip,
} from "./validate";

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

function toObjectIdOrNull(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

// ─── Public action types ──────────────────────────────────────────────────

export interface DripVersionEntry {
  versionId: string;
  savedAt: string;
  savedBy?: string;
  draft: DraftDrip;
}

export interface DripDoc {
  id: string;
  workspaceId: string;
  draft: DraftDrip;
  enabled: boolean;
  activeRecipients: number;
  errorCount: number;
  versions: DripVersionEntry[];
  createdAt: string;
  updatedAt: string;
}

export type DripSaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; validationErrors?: string[] };

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Hydrate a single drip for the builder. Returns `null` if the id is
 * malformed or owned by another workspace — the page handles this by
 * rendering a 404-style empty state.
 */
export async function loadDripById(
  workspaceId: string,
  id: string,
): Promise<DripDoc | null> {
  const { cols } = await getSabsmsCollections();

  // The drip id may be either an ObjectId (existing doc) or the literal
  // "new" (the route fires a fresh-draft page). The page hands us "new"
  // already lowered to a generated ObjectId so we can keep this branch
  // small.
  const oid = toObjectIdOrNull(id);
  if (!oid) return null;

  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId } as never,
  );
  if (!doc) return null;

  // The engine stores the canonical `steps[]` shape; the builder layers
  // a richer `draft` graph on top. We tolerate either by falling back
  // to a minimal draft compiled from `steps`.
  const draft: DraftDrip =
    (doc as unknown as { draft?: DraftDrip }).draft ??
    fallbackDraftFromSteps(doc as unknown as { name: string; steps: Array<{ templateId: string; waitSeconds: number }>; entryTrigger: DraftDrip["entryTrigger"]; enabled: boolean });

  const versions =
    ((doc as unknown as { versions?: DripVersionEntry[] }).versions ?? []) as DripVersionEntry[];

  return {
    id: String(doc._id),
    workspaceId: doc.workspaceId,
    draft,
    enabled: doc.enabled,
    activeRecipients:
      (doc as unknown as { activeRecipients?: number }).activeRecipients ?? 0,
    errorCount: (doc as unknown as { errorCount?: number }).errorCount ?? 0,
    versions,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function fallbackDraftFromSteps(doc: {
  name: string;
  steps: Array<{ templateId: string; waitSeconds: number }>;
  entryTrigger: DraftDrip["entryTrigger"];
  enabled: boolean;
}): DraftDrip {
  const nodes: DraftDrip["nodes"] = [{ id: "start", kind: "start" }];
  const edges: DraftDrip["edges"] = [];
  let prev = "start";
  doc.steps.forEach((s, idx) => {
    if (s.waitSeconds > 0) {
      const wid = `wait_${idx}`;
      nodes.push({ id: wid, kind: "wait", waitSeconds: s.waitSeconds, waitMode: "relative" });
      edges.push({ id: `${prev}->${wid}`, from: prev, to: wid });
      prev = wid;
    }
    const mid = `msg_${idx}`;
    nodes.push({ id: mid, kind: "message", templateId: s.templateId });
    edges.push({ id: `${prev}->${mid}`, from: prev, to: mid });
    prev = mid;
  });
  nodes.push({ id: "exit", kind: "exit" });
  edges.push({ id: `${prev}->exit`, from: prev, to: "exit" });
  return {
    name: doc.name,
    enabled: doc.enabled,
    entryTrigger: doc.entryTrigger,
    nodes,
    edges,
  };
}

/**
 * Approved templates for the step-picker dropdown.
 */
export async function loadTemplateOptions(
  workspaceId: string,
): Promise<Array<{ id: string; name: string; category: string }>> {
  const { cols } = await getSabsmsCollections();
  const docs = await cols.templates
    .find({ workspaceId })
    .project({ name: 1, category: 1, status: 1 })
    .sort({ name: 1 })
    .limit(500)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    name: (d as unknown as { name: string }).name,
    category: (d as unknown as { category: string }).category ?? "marketing",
  }));
}

/**
 * Read-only list of every other drip in this workspace — used by the
 * "Clone steps from another drip" feature.
 */
export async function loadOtherDripsForClone(
  workspaceId: string,
  excludeId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { cols } = await getSabsmsCollections();
  const docs = await cols.drips
    .find({ workspaceId })
    .project({ name: 1 })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
  return docs
    .filter((d) => String(d._id) !== excludeId)
    .map((d) => ({
      id: String(d._id),
      name: (d as unknown as { name: string }).name,
    }));
}

// ─── Mutations ────────────────────────────────────────────────────────────

/**
 * Persist the drip. Refuses to save if validation fails — callers get
 * `validationErrors[]` to render inline next to misbehaving nodes.
 */
export async function saveDrip(
  id: string,
  draft: DraftDrip,
): Promise<DripSaveResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };

  const validation = validateDrip(draft);
  if (!validation.ok) {
    return { ok: false, error: "validation_failed", validationErrors: validation.errors };
  }

  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };

  const steps = compileDripToSteps(draft);
  const now = new Date();
  const versionEntry: DripVersionEntry = {
    versionId: new ObjectId().toHexString(),
    savedAt: now.toISOString(),
    draft,
  };

  const { cols } = await getSabsmsCollections();
  await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    {
      $set: {
        name: draft.name,
        enabled: draft.enabled,
        entryTrigger: draft.entryTrigger,
        steps,
        draft,
        updatedAt: now,
      },
      $push: { versions: { $each: [versionEntry], $slice: -25 } } as never,
      $setOnInsert: { workspaceId: ws.workspaceId, createdAt: now },
    },
    { upsert: true },
  );

  revalidatePath(`/sabsms/drips/${id}`);
  revalidatePath("/sabsms/drips");
  return { ok: true, id };
}

/**
 * Toggle the drip on or off — also exposed from the list page row
 * action. We do not push a new version entry here; pausing is an
 * operational toggle, not a draft change.
 */
export async function setDripEnabled(
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const res = await cols.drips.updateOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    { $set: { enabled, updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) return { ok: false, error: "not_found" };
  revalidatePath(`/sabsms/drips/${id}`);
  revalidatePath("/sabsms/drips");
  return { ok: true };
}

/**
 * Roll back to a previous version. Pushes the current draft onto the
 * versions array first so the rollback itself is reversible.
 */
export async function rollbackToVersion(
  id: string,
  versionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
  );
  if (!doc) return { ok: false, error: "not_found" };
  const versions = ((doc as unknown as { versions?: DripVersionEntry[] }).versions ?? []) as DripVersionEntry[];
  const target = versions.find((v) => v.versionId === versionId);
  if (!target) return { ok: false, error: "version_not_found" };

  return await saveDrip(id, target.draft);
}

/**
 * Dry-run a drip with a sample contact. Tries the engine first; if it
 * is not reachable, returns a deterministic local trace so the UI is
 * still useful in dev.
 */
export interface DryRunStep {
  index: number;
  templateId: string;
  scheduledAt: string;
  skipped: boolean;
  skipReason?: string;
}

export async function dryRunDrip(
  id: string,
  contact: { phoneE164: string; firstName?: string },
): Promise<{ ok: boolean; steps: DryRunStep[]; error?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, steps: [], error: ws.error };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, steps: [], error: "invalid_id" };

  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
  );
  if (!doc) return { ok: false, steps: [], error: "not_found" };

  // Try the engine first.
  try {
    const result = await (sabsmsEngine as unknown as {
      dryRunDrip?: (input: { dripId: string; contact: typeof contact }) => Promise<{ steps: DryRunStep[] }>;
    }).dryRunDrip?.({ dripId: id, contact });
    if (result?.steps) return { ok: true, steps: result.steps };
  } catch (err) {
    if (!(err instanceof SabsmsEngineError)) {
      // Re-throw unexpected runtime errors; engine HTTP errors fall
      // through to the local fallback below.
      throw err;
    }
  }

  // Local fallback — simulate using the compiled steps.
  const steps = (doc as unknown as { steps: Array<{ templateId: string; waitSeconds: number }> }).steps ?? [];
  let cursor = Date.now();
  const out: DryRunStep[] = steps.map((s, i) => {
    cursor += (s.waitSeconds ?? 0) * 1000;
    return {
      index: i,
      templateId: s.templateId,
      scheduledAt: new Date(cursor).toISOString(),
      skipped: false,
    };
  });
  return { ok: true, steps: out };
}

/**
 * "Suggest next step" — Phase 13 will route this through the LLM
 * gateway. Until then we return a heuristic suggestion based on the
 * last node in the draft so the UI affordance is testable.
 */
export async function suggestNextStep(
  draft: DraftDrip,
): Promise<{ kind: "wait" | "message" | "branch"; rationale: string }> {
  const lastNode = draft.nodes[draft.nodes.length - 1];
  if (!lastNode || lastNode.kind === "start") {
    return { kind: "message", rationale: "Open with a welcome message." };
  }
  if (lastNode.kind === "message") {
    return { kind: "wait", rationale: "Wait 24h before the next nudge." };
  }
  if (lastNode.kind === "wait") {
    return {
      kind: "branch",
      rationale: "Branch on whether the contact replied within the wait window.",
    };
  }
  return { kind: "exit", rationale: "Close out the journey." } as never;
}

/**
 * Clone the step list from another drip into this draft. Returns the
 * resulting draft so the client can show a preview before committing.
 */
export async function cloneStepsFromDrip(
  targetId: string,
  sourceId: string,
  currentDraft: DraftDrip,
): Promise<{ ok: boolean; draft?: DraftDrip; error?: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, error: ws.error };
  const oid = toObjectIdOrNull(sourceId);
  if (!oid) return { ok: false, error: "invalid_id" };
  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
  );
  if (!doc) return { ok: false, error: "not_found" };
  const source = (doc as unknown as { draft?: DraftDrip }).draft;
  if (!source) return { ok: false, error: "source_has_no_draft" };

  // Merge: keep current start/exit, append source's middle nodes with
  // a stable prefix so ids never collide.
  const prefix = `cloned_${Date.now()}_`;
  const middle = source.nodes.filter((n) => n.kind !== "start" && n.kind !== "exit");
  const renamed = middle.map((n) => ({ ...n, id: `${prefix}${n.id}` }));
  const edges = source.edges
    .filter((e) => {
      const fromKind = source.nodes.find((n) => n.id === e.from)?.kind;
      const toKind = source.nodes.find((n) => n.id === e.to)?.kind;
      return fromKind !== "start" && fromKind !== "exit" && toKind !== "start" && toKind !== "exit";
    })
    .map((e) => ({
      ...e,
      id: `${prefix}${e.id}`,
      from: `${prefix}${e.from}`,
      to: `${prefix}${e.to}`,
    }));

  const draft: DraftDrip = {
    ...currentDraft,
    nodes: [...currentDraft.nodes, ...renamed],
    edges: [...currentDraft.edges, ...edges],
  };
  return { ok: true, draft };
}

/**
 * Live enrol counter — separate read so the builder can poll it.
 */
export async function getLiveEnrolCount(
  id: string,
): Promise<{ ok: boolean; count: number }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { ok: false, count: 0 };
  const oid = toObjectIdOrNull(id);
  if (!oid) return { ok: false, count: 0 };
  const { cols } = await getSabsmsCollections();
  const doc = await cols.drips.findOne(
    { _id: oid, workspaceId: ws.workspaceId } as never,
    { projection: { activeRecipients: 1 } },
  );
  return { ok: true, count: (doc as unknown as { activeRecipients?: number } | null)?.activeRecipients ?? 0 };
}
