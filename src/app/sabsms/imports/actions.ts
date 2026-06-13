"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * SabSMS imports — server actions.
 *
 * Reads and writes the `sabsms_imports` collection (workspace-scoped).
 *
 * TODO(follow-up): register `sabsms_imports` in
 *   `src/lib/sabsms/db/collections.ts` so it gets typed access via
 *   `getSabsmsCollections()` and an index spec runs at boot.
 *
 * The Rust engine owns the heavy-lift import worker; this surface only
 * orchestrates the job lifecycle (queue / pause / resume / cancel /
 * retry / rollback) and audit-trail writes. Failed-row CSVs are stored
 * inline on the import doc — the page-side `<SabsmsExportMenu>` renders
 * them on demand.
 */

import { ObjectId, type Filter, type WithId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { rowsToCsv } from "@/components/sabsms/page-toolkit";

// ─── Types ────────────────────────────────────────────────────────────────

/** Collection name — not yet registered in `db/collections.ts`. */
const SABSMS_IMPORTS_COLLECTION = "sabsms_imports";

export type ImportStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface ImportAuditEvent {
  at: string;
  kind: string;
  message?: string;
  actorId?: string;
}

export interface ImportFailedRow {
  rowIndex: number;
  phone?: string;
  reason: string;
}

export interface ImportRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: ImportStatus;
  source: "csv";
  sabFileId?: string;
  sabFileUrl?: string;
  mapping: {
    phone?: string;
    name?: string;
    email?: string;
    tags?: string;
  };
  options: {
    skipSuppressed: boolean;
    skipDuplicates: boolean;
    consentAttested: boolean;
    bulkTags: string[];
    segmentId?: string;
    listId?: string;
    webhookUrl?: string;
    cronExpression?: string;
  };
  counts: {
    total: number;
    imported: number;
    failed: number;
    skipped: number;
  };
  costEstimate?: { units: number; currency: string; amount: number };
  failedRows: ImportFailedRow[];
  audit: ImportAuditEvent[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

interface ImportDoc {
  workspaceId: string;
  name: string;
  status: ImportStatus;
  source: "csv";
  sabFileId?: string;
  sabFileUrl?: string;
  mapping: ImportRecord["mapping"];
  options: ImportRecord["options"];
  counts: ImportRecord["counts"];
  costEstimate?: ImportRecord["costEstimate"];
  failedRows: ImportFailedRow[];
  audit: ImportAuditEvent[];
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export type ImportsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface ImportsListFilters {
  q?: string;
  status?: string[];
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "largest";
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string; userId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: (await getSabsmsWorkspaceId()) ?? "", userId: String(userId) };
}

async function importsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ImportDoc>(SABSMS_IMPORTS_COLLECTION);
}

function toIso(d?: Date | string): string {
  if (!d) return "";
  return typeof d === "string" ? d : d.toISOString();
}

function project(doc: WithId<ImportDoc>): ImportRecord {
  return {
    id: String(doc._id),
    workspaceId: doc.workspaceId,
    name: doc.name,
    status: doc.status,
    source: doc.source,
    sabFileId: doc.sabFileId,
    sabFileUrl: doc.sabFileUrl,
    mapping: doc.mapping,
    options: doc.options,
    counts: doc.counts,
    costEstimate: doc.costEstimate,
    failedRows: doc.failedRows ?? [],
    audit: doc.audit ?? [],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    startedAt: doc.startedAt ? toIso(doc.startedAt) : undefined,
    finishedAt: doc.finishedAt ? toIso(doc.finishedAt) : undefined,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadImports(
  workspaceId: string,
  filters: ImportsListFilters,
): Promise<ImportRecord[]> {
  const col = await importsCollection();
  const filter: Filter<ImportDoc> = { workspaceId };

  if (filters.status && filters.status.length > 0) {
    filter.status = { $in: filters.status as ImportStatus[] };
  }
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {};
    if (filters.from) range.$gte = new Date(filters.from);
    if (filters.to) range.$lte = new Date(filters.to);
    filter.createdAt = range as never;
  }
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    filter.name = rx as never;
  }

  const sortMap: Record<
    NonNullable<ImportsListFilters["sort"]>,
    Record<string, 1 | -1>
  > = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    largest: { "counts.total": -1 },
  };
  const sort = sortMap[filters.sort ?? "newest"];

  const docs = await col.find(filter).sort(sort).limit(200).toArray();
  return docs.map(project);
}

export async function loadImportById(
  workspaceId: string,
  importId: string,
): Promise<ImportRecord | null> {
  if (!ObjectId.isValid(importId)) return null;
  const col = await importsCollection();
  const doc = await col.findOne({
    _id: new ObjectId(importId),
    workspaceId,
  });
  return doc ? project(doc) : null;
}

// ─── Mutations ────────────────────────────────────────────────────────────

export interface CreateImportInput {
  name: string;
  sabFileId?: string;
  sabFileUrl?: string;
  mapping: ImportRecord["mapping"];
  options: ImportRecord["options"];
  totalRows: number;
  costEstimate?: ImportRecord["costEstimate"];
}

export async function createImport(
  input: CreateImportInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!input.name?.trim()) {
    return { ok: false, error: "Import name is required." };
  }
  if (!input.mapping.phone) {
    return { ok: false, error: "Phone column mapping is required." };
  }
  if (!input.options.consentAttested) {
    return {
      ok: false,
      error: "Consent attestation is required for marketing imports.",
    };
  }

  const now = new Date();
  const col = await importsCollection();
  const doc: ImportDoc = {
    workspaceId: ws.workspaceId,
    name: input.name.trim(),
    status: "queued",
    source: "csv",
    sabFileId: input.sabFileId,
    sabFileUrl: input.sabFileUrl,
    mapping: input.mapping,
    options: input.options,
    counts: {
      total: input.totalRows,
      imported: 0,
      failed: 0,
      skipped: 0,
    },
    costEstimate: input.costEstimate,
    failedRows: [],
    audit: [
      {
        at: now.toISOString(),
        kind: "created",
        message: `Import "${input.name.trim()}" queued (${input.totalRows} rows).`,
        actorId: ws.userId,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  const result = await col.insertOne(doc);
  return { ok: true, id: String(result.insertedId) };
}

async function transitionStatus(
  importId: string,
  workspaceId: string,
  userId: string,
  from: ImportStatus[],
  to: ImportStatus,
  message: string,
): Promise<ImportsActionResult> {
  if (!ObjectId.isValid(importId)) {
    return { ok: false, error: "Invalid import id." };
  }
  const col = await importsCollection();
  const now = new Date();
  const update: Record<string, unknown> = {
    $set: { status: to, updatedAt: now },
    $push: {
      audit: {
        at: now.toISOString(),
        kind: to,
        message,
        actorId: userId,
      },
    },
  };
  if (to === "running" && !(update.$set as Record<string, unknown>).startedAt) {
    (update.$set as Record<string, unknown>).startedAt = now;
  }
  if (to === "completed" || to === "cancelled" || to === "failed") {
    (update.$set as Record<string, unknown>).finishedAt = now;
  }
  const res = await col.updateOne(
    {
      _id: new ObjectId(importId),
      workspaceId,
      status: { $in: from },
    },
    update,
  );
  if (res.matchedCount === 0) {
    return { ok: false, error: "Import not in a state that allows this action." };
  }
  return { ok: true };
}

export async function pauseImport(importId: string): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  return transitionStatus(
    importId,
    ws.workspaceId,
    ws.userId,
    ["queued", "running"],
    "paused",
    "Import paused.",
  );
}

export async function resumeImport(importId: string): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  return transitionStatus(
    importId,
    ws.workspaceId,
    ws.userId,
    ["paused"],
    "running",
    "Import resumed.",
  );
}

export async function cancelImport(importId: string): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  return transitionStatus(
    importId,
    ws.workspaceId,
    ws.userId,
    ["queued", "running", "paused"],
    "cancelled",
    "Import cancelled.",
  );
}

export async function retryFailedRows(
  importId: string,
): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(importId)) {
    return { ok: false, error: "Invalid import id." };
  }
  const col = await importsCollection();
  const now = new Date();
  const res = await col.updateOne(
    {
      _id: new ObjectId(importId),
      workspaceId: ws.workspaceId,
      status: { $in: ["completed", "failed"] },
    },
    {
      $set: { status: "queued", updatedAt: now },
      $push: {
        audit: {
          at: now.toISOString(),
          kind: "retry",
          message: "Retrying failed rows.",
          actorId: ws.userId,
        },
      },
    },
  );
  if (res.matchedCount === 0) {
    return { ok: false, error: "Import not in a state that allows retry." };
  }
  return { ok: true };
}

export async function rollbackImport(
  importId: string,
): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(importId)) {
    return { ok: false, error: "Invalid import id." };
  }
  const col = await importsCollection();
  const now = new Date();
  // TODO(follow-up): when the Rust worker writes
  // `sabsms_contacts` per-import, delete those rows here. For now we
  // just mark the import as rolled back via the audit trail.
  const res = await col.updateOne(
    { _id: new ObjectId(importId), workspaceId: ws.workspaceId },
    {
      $set: { status: "cancelled", updatedAt: now },
      $push: {
        audit: {
          at: now.toISOString(),
          kind: "rollback",
          message:
            "Rollback requested — rows scheduled for deletion by the engine.",
          actorId: ws.userId,
        },
      },
    },
  );
  if (res.matchedCount === 0) {
    return { ok: false, error: "Import not found." };
  }
  return { ok: true };
}

export async function deleteImport(
  importId: string,
): Promise<ImportsActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(importId)) {
    return { ok: false, error: "Invalid import id." };
  }
  const col = await importsCollection();
  const res = await col.deleteOne({
    _id: new ObjectId(importId),
    workspaceId: ws.workspaceId,
  });
  if (res.deletedCount === 0) {
    return { ok: false, error: "Import not found." };
  }
  return { ok: true };
}

// ─── Failed-row CSV ───────────────────────────────────────────────────────

export async function failedRowsCsv(
  workspaceId: string,
  importId: string,
): Promise<string> {
  const rec = await loadImportById(workspaceId, importId);
  if (!rec) return "rowIndex,phone,reason\n";
  return rowsToCsv(
    rec.failedRows.map((r) => ({
      rowIndex: r.rowIndex,
      phone: r.phone ?? "",
      reason: r.reason,
    })),
    [
      { key: "rowIndex", header: "Row" },
      { key: "phone", header: "Phone" },
      { key: "reason", header: "Reason" },
    ],
  );
}
