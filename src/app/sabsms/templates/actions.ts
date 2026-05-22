"use server";

/**
 * SabSMS templates list — server actions.
 *
 * Reads + writes for Page 9 (`/sabsms/templates`). All work is scoped by
 * `workspaceId` resolved from `getCachedSession()`. The Rust SabSMS
 * engine owns the wire shapes (see `@/lib/sabsms/types`) — this module
 * only reads them and toggles a handful of UX-layer fields
 * (`tags`, `deprecated`, `submittedAt`) that the engine ignores.
 */

import { ObjectId, type Filter } from "mongodb";
import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type {
  SabsmsTemplate,
  SabsmsTemplateBody,
  SabsmsTemplateCategory,
  SabsmsTemplateStatus,
} from "@/lib/sabsms/types";

import { projectTemplate, type TemplateDocExt, type TemplateRow } from "./projection";

// ─── Auth ────────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

// ─── View model ──────────────────────────────────────────────────────────

export interface TemplateListFilters {
  q?: string;
  status?: string[];
  category?: string[];
  locale?: string[];
  sort?: "newest" | "name" | "usage" | "updated";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIso(d?: Date | string | null): string | null {
  if (!d) return null;
  return typeof d === "string" ? d : d.toISOString();
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function loadTemplates(
  workspaceId: string,
  filters: TemplateListFilters,
): Promise<TemplateRow[]> {
  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsTemplate> = { workspaceId };

  if (filters.status && filters.status.length > 0) {
    filter.status = { $in: filters.status as SabsmsTemplateStatus[] };
  }
  if (filters.category && filters.category.length > 0) {
    filter.category = {
      $in: filters.category as SabsmsTemplateCategory[],
    };
  }
  if (filters.locale && filters.locale.length > 0) {
    (filter as Record<string, unknown>)["bodies.locale"] = {
      $in: filters.locale,
    };
  }
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    (filter as Record<string, unknown>).$or = [
      { name: rx },
      { "bodies.body": rx },
    ];
  }

  const sortMap: Record<
    NonNullable<TemplateListFilters["sort"]>,
    Record<string, 1 | -1>
  > = {
    newest: { createdAt: -1 },
    name: { name: 1 },
    usage: { usageCount: -1, updatedAt: -1 },
    updated: { updatedAt: -1 },
  };
  const sort = sortMap[filters.sort ?? "newest"];

  const docs = (await cols.templates
    .find(filter)
    .sort(sort)
    .limit(500)
    .toArray()) as TemplateDocExt[];

  return docs.map(projectTemplate);
}

// ─── Mutations ───────────────────────────────────────────────────────────

export type TemplateActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function asObjectId(id: string): Promise<ObjectId | null> {
  if (!id || !ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

/** Feature 10 — duplicate a template (suffix " (copy)" and bump name). */
export async function duplicateTemplate(
  id: string,
): Promise<TemplateActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const oid = await asObjectId(id);
  if (!oid) return { ok: false, error: "invalid template id" };

  const { cols } = await getSabsmsCollections();
  const src = await cols.templates.findOne({
    _id: oid,
    workspaceId: ws.workspaceId,
  });
  if (!src) return { ok: false, error: "template not found" };

  const now = new Date();
  const nameBase = `${src.name} (copy)`;
  let name = nameBase;
  let counter = 2;
  // Ensure name uniqueness (unique index on { workspaceId, name }).
  while (
    await cols.templates.findOne({ workspaceId: ws.workspaceId, name })
  ) {
    name = `${nameBase} ${counter++}`;
    if (counter > 50) break;
  }

  const copy: SabsmsTemplate = {
    workspaceId: ws.workspaceId,
    name,
    category: src.category,
    bodies: src.bodies,
    variables: src.variables,
    status: "draft",
    dlt: src.dlt,
    tendlc: src.tendlc,
    createdAt: now,
    updatedAt: now,
  };
  const res = await cols.templates.insertOne(copy);
  revalidatePath("/sabsms/templates");
  return { ok: true, id: String(res.insertedId) };
}

/** Feature 11 — submit for approval (bulk). */
export async function submitTemplatesForApproval(
  ids: string[],
): Promise<TemplateActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const oids: ObjectId[] = [];
  for (const id of ids) {
    const oid = await asObjectId(id);
    if (oid) oids.push(oid);
  }
  if (oids.length === 0) return { ok: false, error: "no valid ids" };

  const { cols } = await getSabsmsCollections();
  const now = new Date();
  await cols.templates.updateMany(
    {
      _id: { $in: oids },
      workspaceId: ws.workspaceId,
      status: { $in: ["draft", "rejected"] as SabsmsTemplateStatus[] },
    },
    {
      $set: {
        status: "submitted" as SabsmsTemplateStatus,
        updatedAt: now,
        ...({ submittedAt: now } as Record<string, unknown>),
      },
    },
  );
  revalidatePath("/sabsms/templates");
  return { ok: true };
}

/** Feature 12 — withdraw a submitted template back to draft. */
export async function withdrawSubmission(
  id: string,
): Promise<TemplateActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const oid = await asObjectId(id);
  if (!oid) return { ok: false, error: "invalid template id" };

  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    {
      _id: oid,
      workspaceId: ws.workspaceId,
      status: "submitted" as SabsmsTemplateStatus,
    },
    {
      $set: {
        status: "draft" as SabsmsTemplateStatus,
        updatedAt: new Date(),
      },
      $unset: { submittedAt: "" },
    },
  );
  revalidatePath("/sabsms/templates");
  return { ok: true };
}

/** Feature 13 — mark deprecated / restore. */
export async function setDeprecated(input: {
  id: string;
  deprecated: boolean;
}): Promise<TemplateActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const oid = await asObjectId(input.id);
  if (!oid) return { ok: false, error: "invalid template id" };

  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    { _id: oid, workspaceId: ws.workspaceId },
    {
      $set: {
        updatedAt: new Date(),
        ...({ deprecated: input.deprecated } as Record<string, unknown>),
      },
    },
  );
  revalidatePath("/sabsms/templates");
  return { ok: true };
}

/** Feature 16 — replace the tag set inline. */
export async function setTemplateTags(input: {
  id: string;
  tags: string[];
}): Promise<TemplateActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const oid = await asObjectId(input.id);
  if (!oid) return { ok: false, error: "invalid template id" };

  const cleaned = Array.from(
    new Set(
      input.tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 64),
    ),
  ).slice(0, 16);

  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    { _id: oid, workspaceId: ws.workspaceId },
    {
      $set: {
        updatedAt: new Date(),
        ...({ tags: cleaned } as Record<string, unknown>),
      },
    },
  );
  revalidatePath("/sabsms/templates");
  return { ok: true };
}

// ─── Import / export (features 17, 18) ───────────────────────────────────

export interface ImportTemplateInput {
  /** Raw JSON bundle text. Accepts a single template or `{ templates: [] }`. */
  json: string;
}

export interface ImportedTemplateSummary {
  inserted: number;
  skipped: number;
  errors: string[];
}

interface RawImportTemplate {
  name?: string;
  category?: string;
  bodies?: Array<{ locale?: string; body?: string }>;
  variables?: string[];
  dlt?: SabsmsTemplate["dlt"];
  tendlc?: SabsmsTemplate["tendlc"];
  /** WhatsApp template shape — flatten to a single `en` body. */
  components?: Array<{ type?: string; text?: string }>;
  language?: string;
}

const VALID_CATEGORIES = new Set<SabsmsTemplateCategory>([
  "transactional",
  "otp",
  "marketing",
  "alert",
  "service",
]);

function normaliseImportEntry(
  raw: RawImportTemplate,
): { ok: true; doc: Omit<SabsmsTemplate, "workspaceId"> } | { ok: false; error: string } {
  if (!raw.name || typeof raw.name !== "string") {
    return { ok: false, error: "missing name" };
  }
  const category = (raw.category ?? "transactional") as SabsmsTemplateCategory;
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, error: `invalid category for ${raw.name}` };
  }

  let bodies: SabsmsTemplateBody[] = [];
  if (Array.isArray(raw.bodies) && raw.bodies.length > 0) {
    bodies = raw.bodies
      .filter((b): b is { locale: string; body: string } =>
        Boolean(b?.locale && typeof b?.body === "string"),
      )
      .map((b) => ({ locale: b.locale, body: b.body }));
  } else if (Array.isArray(raw.components)) {
    // Flatten a WhatsApp template "components" array.
    const text = raw.components
      .filter((c) => c?.type?.toLowerCase() === "body" && typeof c.text === "string")
      .map((c) => c.text!)
      .join("\n");
    bodies = [{ locale: raw.language ?? "en", body: text }];
  }
  if (bodies.length === 0 || bodies.every((b) => !b.body.trim())) {
    return { ok: false, error: `${raw.name} has no body` };
  }

  const now = new Date();
  const doc: Omit<SabsmsTemplate, "workspaceId"> = {
    name: raw.name,
    category,
    bodies,
    variables: raw.variables,
    status: "draft",
    dlt: raw.dlt,
    tendlc: raw.tendlc,
    createdAt: now,
    updatedAt: now,
  };
  return { ok: true, doc };
}

export async function importTemplates(
  input: ImportTemplateInput,
): Promise<{ ok: true; summary: ImportedTemplateSummary } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.json);
  } catch {
    return { ok: false, error: "Bundle is not valid JSON" };
  }

  const list: RawImportTemplate[] = Array.isArray(parsed)
    ? (parsed as RawImportTemplate[])
    : Array.isArray((parsed as { templates?: unknown[] })?.templates)
      ? ((parsed as { templates: RawImportTemplate[] }).templates)
      : [parsed as RawImportTemplate];

  const { cols } = await getSabsmsCollections();
  const summary: ImportedTemplateSummary = {
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (const raw of list) {
    const result = normaliseImportEntry(raw);
    if (!result.ok) {
      summary.errors.push(result.error);
      summary.skipped += 1;
      continue;
    }
    try {
      await cols.templates.insertOne({
        ...result.doc,
        workspaceId: ws.workspaceId,
      } as SabsmsTemplate);
      summary.inserted += 1;
    } catch (e) {
      summary.errors.push(
        `${result.doc.name}: ${(e as Error)?.message ?? "insert failed"}`,
      );
      summary.skipped += 1;
    }
  }

  revalidatePath("/sabsms/templates");
  return { ok: true, summary };
}

/** Feature 18 — export selected (or all) templates as a JSON bundle. */
export async function exportTemplateBundle(
  ids?: string[],
): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsTemplate> = { workspaceId: ws.workspaceId };
  if (ids && ids.length > 0) {
    const oids = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (oids.length === 0) return { ok: false, error: "no valid ids" };
    filter._id = { $in: oids };
  }
  const docs = await cols.templates.find(filter).toArray();
  const bundle = {
    exportedAt: new Date().toISOString(),
    templates: docs.map((d) => ({
      name: d.name,
      category: d.category,
      bodies: d.bodies,
      variables: d.variables,
      dlt: d.dlt,
      tendlc: d.tendlc,
    })),
  };
  return { ok: true, json: JSON.stringify(bundle, null, 2) };
}

// ─── Audit history (feature 20) ──────────────────────────────────────────

/**
 * TODO(audit log collection): SabSMS has no dedicated audit collection
 * yet. We synthesise a minimal history from the template document's
 * lifecycle fields (`createdAt`, `submittedAt`, `updatedAt`) so the
 * detail drawer renders something useful. When a real
 * `sabsms_audit_log` collection lands, swap this out for a proper
 * `find({ workspaceId, subjectId })` query.
 */
export interface TemplateAuditEvent {
  at: string;
  kind: "created" | "submitted" | "updated";
  detail: string;
}

export async function loadTemplateAudit(
  id: string,
): Promise<TemplateAuditEvent[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const oid = await asObjectId(id);
  if (!oid) return [];

  const { cols } = await getSabsmsCollections();
  const doc = (await cols.templates.findOne({
    _id: oid,
    workspaceId: ws.workspaceId,
  })) as TemplateDocExt | null;
  if (!doc) return [];

  const events: TemplateAuditEvent[] = [];
  if (doc.createdAt) {
    events.push({
      at: toIso(doc.createdAt) ?? "",
      kind: "created",
      detail: `Template "${doc.name}" created`,
    });
  }
  if (doc.submittedAt) {
    events.push({
      at: toIso(doc.submittedAt) ?? "",
      kind: "submitted",
      detail: `Submitted for approval`,
    });
  }
  if (doc.updatedAt) {
    events.push({
      at: toIso(doc.updatedAt) ?? "",
      kind: "updated",
      detail: `Last updated (status: ${doc.status})`,
    });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}
