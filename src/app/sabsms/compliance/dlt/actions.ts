"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * SabSMS V2.8 — server actions for the India DLT registries.
 *
 * The Next.js side OWNS the CRUD for the four `sabsms_dlt_*`
 * collections; the Rust engine only reads them (see
 * `services/sabsms-engine/src/compliance/dlt_store.rs`) through a 60s
 * per-workspace cache, so EVERY write here must end with
 * `sabsmsEngine.invalidateDlt(workspaceId)`.
 *
 * Wire shapes (camelCase fields, snake_case `category`) are enforced by
 * the zod schemas in `./schema.ts` — they mirror the Rust
 * `*_from_doc` parsers field-for-field.
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { connectToDatabase } from "@/lib/mongodb";
import { sabsmsEngine, SabsmsEngineError, type SabsmsDltScrubPreview } from "@/lib/sabsms/engine-client";

import {
  dltChainInputSchema,
  dltEntityInputSchema,
  dltHeaderInputSchema,
  dltTemplateInputSchema,
  type DltChainRow,
  type DltEntityRow,
  type DltHeaderRow,
  type DltRegistryView,
  type DltTemplateRow,
} from "./schema";
import type { DltImportKind } from "./csv-mapping";

// ─── Collections (engine: services/sabsms-engine/src/db.rs) ──────────────

const COL_DLT_ENTITIES = "sabsms_dlt_entities";
const COL_DLT_HEADERS = "sabsms_dlt_headers";
const COL_DLT_TEMPLATES = "sabsms_dlt_templates";
const COL_DLT_CHAINS = "sabsms_dlt_chains";

const PAGE_PATH = "/sabsms/compliance/dlt";

// ─── Auth + helpers (pattern: ../../providers/actions.ts) ────────────────

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

type ActionErr = { success: false; error: string };
const unauthorized: ActionErr = { success: false, error: "Unauthorized" };

function zodError(err: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const first = err.issues[0];
  if (!first) return "Invalid input";
  const path = first.path.map(String).join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

/** Invalidate the engine's registry cache + the page's RSC payload. */
async function afterWrite(workspaceId: string) {
  await sabsmsEngine.invalidateDlt(workspaceId);
  revalidatePath(PAGE_PATH);
}

// ─── Read: full registry view ─────────────────────────────────────────────

/**
 * Session-scoped registry read — also called directly from the server
 * components (`page.tsx` here and the templates editor page).
 *
 * NOTE: every export of this 'use server' file is client-invokable, so
 * the workspace id is ALWAYS derived from the session — never accepted
 * as a parameter.
 */
export async function loadDltRegistryAction(): Promise<
  { success: true; registry: DltRegistryView } | ActionErr
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const registry = await loadRegistry(workspaceId);
  return { success: true, registry };
}

async function loadRegistry(workspaceId: string): Promise<DltRegistryView> {
  const { db } = await connectToDatabase();

  const [entities, headers, templates, chain] = await Promise.all([
    db.collection(COL_DLT_ENTITIES).find({ workspaceId }).sort({ peId: 1 }).limit(500).toArray(),
    db.collection(COL_DLT_HEADERS).find({ workspaceId }).sort({ header: 1 }).limit(1000).toArray(),
    db.collection(COL_DLT_TEMPLATES).find({ workspaceId }).sort({ templateId: 1 }).limit(2000).toArray(),
    db.collection(COL_DLT_CHAINS).findOne({ workspaceId }),
  ]);

  return {
    entities: entities.map(
      (d: any): DltEntityRow => ({
        id: String(d._id),
        peId: String(d.peId ?? ""),
        name: String(d.name ?? ""),
        status: d.status === "inactive" ? "inactive" : "active",
      }),
    ),
    headers: headers.map(
      (d: any): DltHeaderRow => ({
        id: String(d._id),
        headerId: String(d.headerId ?? ""),
        header: String(d.header ?? ""),
        category: d.category,
      }),
    ),
    templates: templates.map(
      (d: any): DltTemplateRow => ({
        id: String(d._id),
        templateId: String(d.templateId ?? ""),
        body: String(d.body ?? ""),
        category: d.category,
        peId: String(d.peId ?? ""),
        headerIds: Array.isArray(d.headerIds) ? d.headerIds.map(String) : [],
        status: d.status === "inactive" ? "inactive" : "active",
      }),
    ),
    chain: chain
      ? {
          id: String((chain as any)._id),
          peId: String((chain as any).peId ?? ""),
          tmIds: Array.isArray((chain as any).tmIds)
            ? (chain as any).tmIds.map(String).slice(0, 2)
            : [],
        }
      : null,
  };
}

// ─── Generic save/delete plumbing ─────────────────────────────────────────

/**
 * Create or update a registry doc.
 *
 * - `id` present → update that doc (workspace-scoped).
 * - no `id` → insert, rejecting duplicates on the natural key
 *   (`peId` / `headerId` / `templateId` per workspace) so re-imports
 *   and double-submits don't fork the registry.
 */
async function saveRegistryDoc(input: {
  collection: string;
  id?: string;
  naturalKey: { field: string; value: string; label: string };
  doc: Record<string, unknown>;
}): Promise<{ success: true; id: string } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;

  const { db } = await connectToDatabase();
  const col = db.collection(input.collection);
  const now = new Date();

  if (input.id) {
    if (!ObjectId.isValid(input.id)) return { success: false, error: "Invalid id" };
    const _id = new ObjectId(input.id);
    // Reject renaming onto another doc's natural key.
    const clash = await col.findOne({
      workspaceId,
      [input.naturalKey.field]: input.naturalKey.value,
      _id: { $ne: _id },
    });
    if (clash) {
      return {
        success: false,
        error: `${input.naturalKey.label} "${input.naturalKey.value}" is already registered`,
      };
    }
    const res = await col.updateOne(
      { _id, workspaceId },
      { $set: { ...input.doc, updatedAt: now } },
    );
    if (res.matchedCount === 0) return { success: false, error: "Not found" };
    await afterWrite(workspaceId);
    return { success: true, id: input.id };
  }

  const existing = await col.findOne({
    workspaceId,
    [input.naturalKey.field]: input.naturalKey.value,
  });
  if (existing) {
    return {
      success: false,
      error: `${input.naturalKey.label} "${input.naturalKey.value}" is already registered`,
    };
  }
  const res = await col.insertOne({
    ...input.doc,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  });
  await afterWrite(workspaceId);
  return { success: true, id: String(res.insertedId) };
}

async function deleteRegistryDoc(
  collection: string,
  id: string,
): Promise<{ success: true } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  if (!ObjectId.isValid(id)) return { success: false, error: "Invalid id" };

  const { db } = await connectToDatabase();
  const res = await db
    .collection(collection)
    .deleteOne({ _id: new ObjectId(id), workspaceId });
  await afterWrite(workspaceId);
  if (res.deletedCount === 0) return { success: false, error: "Not found" };
  return { success: true };
}

// ─── Entities (`sabsms_dlt_entities`) ─────────────────────────────────────

export async function saveDltEntityAction(input: {
  id?: string;
  peId: string;
  name: string;
  status?: string;
}): Promise<{ success: true; id: string } | ActionErr> {
  const parsed = dltEntityInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  return saveRegistryDoc({
    collection: COL_DLT_ENTITIES,
    id: input.id,
    naturalKey: { field: "peId", value: parsed.data.peId, label: "PE ID" },
    doc: parsed.data,
  });
}

export async function deleteDltEntityAction(id: string) {
  return deleteRegistryDoc(COL_DLT_ENTITIES, id);
}

// ─── Headers (`sabsms_dlt_headers`) ───────────────────────────────────────

export async function saveDltHeaderAction(input: {
  id?: string;
  headerId: string;
  header: string;
  category: string;
}): Promise<{ success: true; id: string } | ActionErr> {
  const parsed = dltHeaderInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  return saveRegistryDoc({
    collection: COL_DLT_HEADERS,
    id: input.id,
    naturalKey: { field: "headerId", value: parsed.data.headerId, label: "Header ID" },
    doc: parsed.data,
  });
}

export async function deleteDltHeaderAction(id: string) {
  return deleteRegistryDoc(COL_DLT_HEADERS, id);
}

// ─── Templates (`sabsms_dlt_templates`) ───────────────────────────────────

export async function saveDltTemplateAction(input: {
  id?: string;
  templateId: string;
  body: string;
  category: string;
  peId?: string;
  headerIds?: string[];
  status?: string;
}): Promise<{ success: true; id: string } | ActionErr> {
  const parsed = dltTemplateInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };
  return saveRegistryDoc({
    collection: COL_DLT_TEMPLATES,
    id: input.id,
    naturalKey: { field: "templateId", value: parsed.data.templateId, label: "Template ID" },
    doc: parsed.data,
  });
}

export async function deleteDltTemplateAction(id: string) {
  return deleteRegistryDoc(COL_DLT_TEMPLATES, id);
}

// ─── PE→TM chain (`sabsms_dlt_chains`, one doc per workspace) ────────────

export async function saveDltChainAction(input: {
  peId: string;
  tmIds: string[];
}): Promise<{ success: true } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;

  const parsed = dltChainInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodError(parsed.error) };

  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COL_DLT_CHAINS).updateOne(
    { workspaceId },
    {
      $set: { ...parsed.data, updatedAt: now },
      $setOnInsert: { workspaceId, createdAt: now },
    },
    { upsert: true },
  );
  await afterWrite(workspaceId);
  return { success: true };
}

export async function deleteDltChainAction(): Promise<{ success: true } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();
  await db.collection(COL_DLT_CHAINS).deleteOne({ workspaceId });
  await afterWrite(workspaceId);
  return { success: true };
}

// ─── CSV bulk import ──────────────────────────────────────────────────────

export interface DltImportRowError {
  /** 1-based data-row number (matches the preview table). */
  row: number;
  error: string;
}

export interface DltImportSummary {
  inserted: number;
  updated: number;
  errors: DltImportRowError[];
}

/**
 * Bulk-import mapped CSV records (output of `mapCsvRows`) into one
 * registry. Each record is validated through the registry's zod input
 * schema; valid rows upsert on the natural key (peId / headerId /
 * templateId), invalid rows are reported back with their row number.
 * One engine invalidation at the end, not per row.
 */
export async function importDltCsvAction(input: {
  kind: DltImportKind;
  records: Array<Record<string, string | string[]>>;
}): Promise<{ success: true; summary: DltImportSummary } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;

  if (!Array.isArray(input.records) || input.records.length === 0) {
    return { success: false, error: "No rows to import" };
  }
  if (input.records.length > 2000) {
    return { success: false, error: "Too many rows (max 2000 per import)" };
  }

  const spec = {
    entities: { schema: dltEntityInputSchema, collection: COL_DLT_ENTITIES, key: "peId" as const },
    headers: { schema: dltHeaderInputSchema, collection: COL_DLT_HEADERS, key: "headerId" as const },
    templates: { schema: dltTemplateInputSchema, collection: COL_DLT_TEMPLATES, key: "templateId" as const },
  }[input.kind];
  if (!spec) return { success: false, error: "Unknown import kind" };

  const { db } = await connectToDatabase();
  const col = db.collection(spec.collection);
  const now = new Date();

  const summary: DltImportSummary = { inserted: 0, updated: 0, errors: [] };

  for (let i = 0; i < input.records.length; i++) {
    const parsed = spec.schema.safeParse(input.records[i]);
    if (!parsed.success) {
      summary.errors.push({ row: i + 1, error: zodError(parsed.error) });
      continue;
    }
    const data = parsed.data as Record<string, unknown>;
    const res = await col.updateOne(
      { workspaceId, [spec.key]: data[spec.key] },
      {
        $set: { ...data, updatedAt: now },
        $setOnInsert: { workspaceId, createdAt: now },
      },
      { upsert: true },
    );
    if (res.upsertedCount > 0) summary.inserted += 1;
    else summary.updated += 1;
  }

  await afterWrite(workspaceId);
  return { success: true, summary };
}

// ─── Live scrub preview (templates editor + compliance hub) ───────────────

export type DltScrubActionResult =
  | { ok: true; preview: SabsmsDltScrubPreview }
  | { ok: false; error: string };

/**
 * "Would this body pass operator scrubbing?" — proxies the engine's
 * `POST /v1/dlt/scrub-preview`. An unreachable/disabled engine is a
 * soft failure (the UI shows "live scrub unavailable", never blocks
 * editing).
 */
export async function dltScrubPreviewAction(input: {
  body: string;
  dltTemplateId?: string;
  header?: string;
}): Promise<DltScrubActionResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Unauthorized" };
  if (!input.body || !input.body.trim()) {
    return { ok: false, error: "Body is empty" };
  }

  try {
    const preview = await sabsmsEngine.scrubPreview({
      workspaceId,
      body: input.body,
      dltTemplateId: input.dltTemplateId?.trim() || undefined,
      header: input.header?.trim() || undefined,
    });
    return { ok: true, preview };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: "Engine unreachable — live scrub unavailable" };
    }
    throw e;
  }
}
