"use server";

/**
 * SabSMS template approval queue — server actions.
 *
 * Reads + writes for Page 11 (`/sabsms/templates/approvals`). The
 * approval workflow lives in three derived fields on the template doc —
 * `status`, `reviewerNotes`, and `submittedAt` — plus a small "decisions"
 * trail that we persist alongside the doc as `approvalHistory[]`.
 *
 * Cross-workspace scope: SabNode doesn't expose a typed
 * "is this user a global admin" helper yet, so we follow the same
 * pattern as `/sabsms/templates/[id]/actions.ts` and scope reads to the
 * caller's workspace. A `?workspaceId=…` query param is honoured but
 * intentionally falls back to the current workspace if no privileged
 * session is detected — see the TODO inline.
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

import {
  APPROVAL_SLA_MS,
  buildAiVerdict,
  computeComplianceScore,
  detectUndeclaredVariables,
  wordDiff,
  type AiVerdictAdvisory,
} from "./heuristics";

async function resolveSession(): Promise<
  { ok: true; workspaceId: string; reviewerId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  const id = String(userId);
  return { ok: true, workspaceId: id, reviewerId: id };
}

// ─── View models ─────────────────────────────────────────────────────────

export interface ApprovalRow {
  id: string;
  workspaceId: string;
  name: string;
  category: SabsmsTemplateCategory;
  status: SabsmsTemplateStatus;
  bodyPreview: string;
  fullBody: string;
  variables: string[];
  undeclaredVariables: string[];
  reviewerId: string | null;
  reviewerNotes: string;
  submitterId: string | null;
  submittedAt: string | null;
  ageMs: number | null;
  slaRemainingMs: number | null;
  slaBreached: boolean;
  complianceScore: number;
  aiVerdict: AiVerdictAdvisory;
  /** Diff vs the last approved version — populated by `loadApprovalDetail`. */
}

export interface ApprovalDecisionRecord {
  id: string;
  at: string;
  kind: "approved" | "rejected" | "flagged" | "resubmitted";
  reviewerId: string;
  notes: string;
  reasonCode?: string;
}

export interface ApprovalListFilters {
  q?: string;
  category?: string[];
  submitterId?: string;
  ageBucket?: "lt_1h" | "lt_24h" | "lt_7d" | "older" | undefined;
  workspaceId?: string;
}

export interface ApprovalQueueStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  /** Average minutes from submission to decision, per category. */
  avgTimeToApprovalMin: Array<{
    category: SabsmsTemplateCategory;
    minutes: number;
    decisions: number;
  }>;
}

interface ApprovalTemplateDoc extends SabsmsTemplate {
  submittedAt?: Date;
  submitterId?: string;
  reviewerId?: string;
  approvalHistory?: Array<{
    at: Date;
    kind: ApprovalDecisionRecord["kind"];
    reviewerId: string;
    notes: string;
    reasonCode?: string;
  }>;
  flaggedForCompliance?: boolean;
  lastApprovedBodies?: SabsmsTemplateBody[];
  lastApprovedAt?: Date;
}

function toIso(d?: Date | null): string | null {
  if (!d) return null;
  return d.toISOString();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function projectApprovalRow(doc: ApprovalTemplateDoc): ApprovalRow {
  const body = doc.bodies?.[0]?.body ?? "";
  const score = computeComplianceScore(body);
  const undeclared = detectUndeclaredVariables(body, doc.variables);
  const submittedAt = doc.submittedAt ?? null;
  const ageMs = submittedAt ? Date.now() - submittedAt.getTime() : null;
  const slaRemainingMs =
    submittedAt ? APPROVAL_SLA_MS - (Date.now() - submittedAt.getTime()) : null;
  return {
    id: String(doc._id),
    workspaceId: doc.workspaceId,
    name: doc.name,
    category: doc.category,
    status: doc.status,
    bodyPreview: body.slice(0, 240),
    fullBody: body,
    variables: doc.variables ?? [],
    undeclaredVariables: undeclared,
    reviewerId: doc.reviewerId ?? null,
    reviewerNotes: doc.reviewerNotes ?? "",
    submitterId: doc.submitterId ?? null,
    submittedAt: toIso(submittedAt),
    ageMs,
    slaRemainingMs,
    slaBreached: slaRemainingMs !== null && slaRemainingMs < 0,
    complianceScore: score,
    aiVerdict: buildAiVerdict(body, score),
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────

export async function loadApprovalQueue(
  filters: ApprovalListFilters,
): Promise<ApprovalRow[]> {
  const session = await resolveSession();
  if (!session.ok) return [];

  // TODO(cross-workspace admin scope): until a typed admin-session helper
  // lands, we honour `filters.workspaceId` only when it matches the
  // caller's workspace. Any privileged "see every workspace" UX will
  // need a real RBAC check here.
  const scope =
    filters.workspaceId && filters.workspaceId === session.workspaceId
      ? filters.workspaceId
      : session.workspaceId;

  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsTemplate> = {
    workspaceId: scope,
    status: "submitted" as SabsmsTemplateStatus,
  };
  if (filters.category && filters.category.length > 0) {
    filter.category = {
      $in: filters.category as SabsmsTemplateCategory[],
    };
  }
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    (filter as Record<string, unknown>).$or = [
      { name: rx },
      { "bodies.body": rx },
    ];
  }
  if (filters.submitterId) {
    (filter as Record<string, unknown>).submitterId = filters.submitterId;
  }
  if (filters.ageBucket) {
    const now = Date.now();
    const bounds: Record<string, [number | null, number | null]> = {
      lt_1h: [null, now - 60 * 60 * 1000],
      lt_24h: [now - 24 * 60 * 60 * 1000, now - 60 * 60 * 1000],
      lt_7d: [now - 7 * 24 * 60 * 60 * 1000, now - 24 * 60 * 60 * 1000],
      older: [null, now - 7 * 24 * 60 * 60 * 1000],
    };
    const [, before] = bounds[filters.ageBucket] ?? [null, null];
    if (before) {
      (filter as Record<string, unknown>).submittedAt = {
        $lte: new Date(before),
      };
    }
  }

  const docs = (await cols.templates
    .find(filter)
    .sort({ submittedAt: 1 })
    .limit(500)
    .toArray()) as ApprovalTemplateDoc[];
  return docs.map(projectApprovalRow);
}

export async function loadApprovalDetail(id: string): Promise<{
  row: ApprovalRow;
  diff: Array<{ kind: "same" | "ins" | "del"; text: string }>;
  hasPreviousApproved: boolean;
  decisions: ApprovalDecisionRecord[];
} | null> {
  const session = await resolveSession();
  if (!session.ok) return null;
  if (!ObjectId.isValid(id)) return null;

  const { cols } = await getSabsmsCollections();
  const doc = (await cols.templates.findOne({
    _id: new ObjectId(id),
    workspaceId: session.workspaceId,
  })) as ApprovalTemplateDoc | null;
  if (!doc) return null;

  const row = projectApprovalRow(doc);
  const current = doc.bodies?.[0]?.body ?? "";
  const previous =
    doc.lastApprovedBodies?.[0]?.body ??
    doc.bodies?.find((b) => b.locale === doc.bodies?.[0]?.locale)?.body ??
    "";
  const hasPreviousApproved = Boolean(doc.lastApprovedBodies?.length);
  const diff = hasPreviousApproved
    ? wordDiff(previous, current)
    : [{ kind: "same" as const, text: current }];
  const decisions: ApprovalDecisionRecord[] =
    (doc.approvalHistory ?? []).map((h, idx) => ({
      id: `${row.id}-${idx}`,
      at: h.at.toISOString(),
      kind: h.kind,
      reviewerId: h.reviewerId,
      notes: h.notes,
      reasonCode: h.reasonCode,
    }));
  return { row, diff, hasPreviousApproved, decisions };
}

export async function loadQueueStats(): Promise<ApprovalQueueStats> {
  const session = await resolveSession();
  if (!session.ok) {
    return { pending: 0, approvedToday: 0, rejectedToday: 0, avgTimeToApprovalMin: [] };
  }
  const { cols } = await getSabsmsCollections();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [pending, approvedToday, rejectedToday] = await Promise.all([
    cols.templates.countDocuments({
      workspaceId: session.workspaceId,
      status: "submitted",
    }),
    cols.templates.countDocuments({
      workspaceId: session.workspaceId,
      status: "approved",
      updatedAt: { $gte: startOfDay },
    }),
    cols.templates.countDocuments({
      workspaceId: session.workspaceId,
      status: "rejected",
      updatedAt: { $gte: startOfDay },
    }),
  ]);

  // Per-category average time-to-approval, derived from
  // `approvalHistory[]` entries on approved templates.
  const approvedDocs = (await cols.templates
    .find({
      workspaceId: session.workspaceId,
      status: "approved",
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
    .project<ApprovalTemplateDoc>({
      category: 1,
      submittedAt: 1,
      approvalHistory: 1,
    })
    .toArray()) as ApprovalTemplateDoc[];

  const buckets = new Map<
    SabsmsTemplateCategory,
    { totalMin: number; count: number }
  >();
  for (const d of approvedDocs) {
    const decided = d.approvalHistory?.find((h) => h.kind === "approved");
    if (!d.submittedAt || !decided) continue;
    const minutes =
      (decided.at.getTime() - d.submittedAt.getTime()) / (1000 * 60);
    const slot = buckets.get(d.category) ?? { totalMin: 0, count: 0 };
    slot.totalMin += minutes;
    slot.count += 1;
    buckets.set(d.category, slot);
  }
  const avgTimeToApprovalMin: ApprovalQueueStats["avgTimeToApprovalMin"] = [];
  for (const [category, { totalMin, count }] of buckets) {
    avgTimeToApprovalMin.push({
      category,
      minutes: count > 0 ? Math.round(totalMin / count) : 0,
      decisions: count,
    });
  }

  return { pending, approvedToday, rejectedToday, avgTimeToApprovalMin };
}

// ─── Mutations ───────────────────────────────────────────────────────────

export type ApprovalResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

interface DecideInput {
  id: string;
  notes: string;
  reasonCode?: string;
  kind: "approved" | "rejected";
}

async function decide(input: DecideInput): Promise<ApprovalResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!input.notes.trim()) {
    return { ok: false, error: "Reviewer notes are required" };
  }
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "invalid id" };
  }

  const { cols } = await getSabsmsCollections();
  const now = new Date();
  const doc = (await cols.templates.findOne({
    _id: new ObjectId(input.id),
    workspaceId: session.workspaceId,
  })) as ApprovalTemplateDoc | null;
  if (!doc) return { ok: false, error: "template not found" };

  const historyEntry = {
    at: now,
    kind: input.kind,
    reviewerId: session.reviewerId,
    notes: input.notes.trim(),
    reasonCode: input.reasonCode,
  };

  const update: Record<string, unknown> = {
    $set: {
      status: input.kind as SabsmsTemplateStatus,
      reviewerNotes: input.notes.trim(),
      updatedAt: now,
      ...(input.kind === "approved"
        ? {
            lastApprovedBodies: doc.bodies,
            lastApprovedAt: now,
          }
        : {}),
    } satisfies Record<string, unknown>,
    $push: {
      approvalHistory: historyEntry,
    } as never,
  };

  await cols.templates.updateOne(
    { _id: new ObjectId(input.id), workspaceId: session.workspaceId },
    update,
  );
  revalidatePath("/sabsms/templates/approvals");
  revalidatePath("/sabsms/templates");
  return { ok: true };
}

export async function approveTemplate(input: {
  id: string;
  notes: string;
}): Promise<ApprovalResult> {
  return decide({ id: input.id, notes: input.notes, kind: "approved" });
}

export async function rejectTemplate(input: {
  id: string;
  notes: string;
  reasonCode?: string;
}): Promise<ApprovalResult> {
  return decide({
    id: input.id,
    notes: input.notes,
    reasonCode: input.reasonCode,
    kind: "rejected",
  });
}

/** Feature 4 — bulk approve every submitted template in a category. */
export async function bulkApproveByCategory(input: {
  category: SabsmsTemplateCategory;
  notes: string;
}): Promise<ApprovalResult & { count?: number }> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!input.notes.trim()) {
    return { ok: false, error: "Reviewer notes are required" };
  }
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  const docs = (await cols.templates
    .find({
      workspaceId: session.workspaceId,
      status: "submitted",
      category: input.category,
    })
    .toArray()) as ApprovalTemplateDoc[];
  if (docs.length === 0) return { ok: true, count: 0 };

  await Promise.all(
    docs.map((d) =>
      cols.templates.updateOne(
        { _id: d._id! },
        {
          $set: {
            status: "approved" as SabsmsTemplateStatus,
            reviewerNotes: input.notes.trim(),
            updatedAt: now,
            lastApprovedBodies: d.bodies,
            lastApprovedAt: now,
          },
          $push: {
            approvalHistory: {
              at: now,
              kind: "approved" as const,
              reviewerId: session.reviewerId,
              notes: input.notes.trim(),
              reasonCode: "bulk_category",
            } as never,
          },
        },
      ),
    ),
  );
  revalidatePath("/sabsms/templates/approvals");
  revalidatePath("/sabsms/templates");
  return { ok: true, count: docs.length };
}

/** Feature 1 — assign a reviewer to a queue item. */
export async function assignReviewer(input: {
  id: string;
  reviewerId: string | null;
}): Promise<ApprovalResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "invalid id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    { _id: new ObjectId(input.id), workspaceId: session.workspaceId },
    {
      $set: {
        reviewerId: input.reviewerId ?? undefined,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath("/sabsms/templates/approvals");
  return { ok: true };
}

/** Feature 6 — flag for compliance review. */
export async function flagForCompliance(input: {
  id: string;
  flagged: boolean;
}): Promise<ApprovalResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!ObjectId.isValid(input.id)) {
    return { ok: false, error: "invalid id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    { _id: new ObjectId(input.id), workspaceId: session.workspaceId },
    {
      $set: {
        updatedAt: new Date(),
        ...({ flaggedForCompliance: input.flagged } as Record<string, unknown>),
      },
    },
  );
  revalidatePath("/sabsms/templates/approvals");
  return { ok: true };
}

/** Feature 17 — resubmit after rejection (from the approvals UI). */
export async function resubmitAfterRejection(
  id: string,
): Promise<ApprovalResult> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const { cols } = await getSabsmsCollections();
  const now = new Date();
  await cols.templates.updateOne(
    {
      _id: new ObjectId(id),
      workspaceId: session.workspaceId,
      status: "rejected" as SabsmsTemplateStatus,
    },
    {
      $set: {
        status: "submitted" as SabsmsTemplateStatus,
        updatedAt: now,
        ...({ submittedAt: now } as Record<string, unknown>),
      },
      $push: {
        approvalHistory: {
          at: now,
          kind: "resubmitted" as const,
          reviewerId: session.reviewerId,
          notes: "Resubmitted by reviewer",
        } as never,
      },
    },
  );
  revalidatePath("/sabsms/templates/approvals");
  return { ok: true };
}

/** Feature 19 — export every currently approved template as a bundle. */
export async function exportApprovedBundle(): Promise<
  { ok: true; json: string } | { ok: false; error: string }
> {
  const session = await resolveSession();
  if (!session.ok) return session;
  const { cols } = await getSabsmsCollections();
  const docs = await cols.templates
    .find({ workspaceId: session.workspaceId, status: "approved" })
    .toArray();
  return {
    ok: true,
    json: JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        templates: docs.map((d) => ({
          name: d.name,
          category: d.category,
          bodies: d.bodies,
          variables: d.variables,
          dlt: d.dlt,
          tendlc: d.tendlc,
        })),
      },
      null,
      2,
    ),
  };
}

/** Feature 14 — export a decision log for the past 30 days. */
export async function exportDecisionLog(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  const session = await resolveSession();
  if (!session.ok) return session;
  const { cols } = await getSabsmsCollections();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const docs = (await cols.templates
    .find({
      workspaceId: session.workspaceId,
      updatedAt: { $gte: since },
    })
    .toArray()) as ApprovalTemplateDoc[];

  const lines = [
    ["templateId", "name", "category", "decisionAt", "kind", "reviewerId", "notes"].join(","),
  ];
  for (const doc of docs) {
    for (const h of doc.approvalHistory ?? []) {
      const csvRow = [
        String(doc._id),
        escapeCsv(doc.name),
        doc.category,
        h.at.toISOString(),
        h.kind,
        h.reviewerId,
        escapeCsv(h.notes),
      ].join(",");
      lines.push(csvRow);
    }
  }
  return { ok: true, csv: lines.join("\n") };
}

function escapeCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ─── Diff (feature 7) ────────────────────────────────────────────────────
// wordDiff lives in ./heuristics.ts so the test suite can exercise it
// without pulling server-only imports.


export async function bulkApproveSelected(input: {
  ids: string[];
  notes: string;
}): Promise<ApprovalResult & { count?: number }> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!input.notes.trim()) return { ok: false, error: "Reviewer notes are required" };
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  
  const objectIds = input.ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  if (objectIds.length === 0) return { ok: true, count: 0 };
  
  const docs = (await cols.templates
    .find({
      _id: { $in: objectIds },
      workspaceId: session.workspaceId,
      status: "submitted",
    })
    .toArray()) as ApprovalTemplateDoc[];
  if (docs.length === 0) return { ok: true, count: 0 };

  await Promise.all(
    docs.map((d) =>
      cols.templates.updateOne(
        { _id: d._id! },
        {
          $set: {
            status: "approved" as SabsmsTemplateStatus,
            reviewerNotes: input.notes.trim(),
            updatedAt: now,
            lastApprovedBodies: d.bodies,
            lastApprovedAt: now,
          },
          $push: {
            approvalHistory: {
              at: now,
              kind: "approved" as const,
              reviewerId: session.reviewerId,
              notes: input.notes.trim(),
              reasonCode: "bulk_selected",
            } as never,
          },
        },
      ),
    ),
  );
  revalidatePath("/sabsms/templates/approvals");
  revalidatePath("/sabsms/templates");
  return { ok: true, count: docs.length };
}

export async function bulkRejectSelected(input: {
  ids: string[];
  notes: string;
  reasonCode?: string;
}): Promise<ApprovalResult & { count?: number }> {
  const session = await resolveSession();
  if (!session.ok) return session;
  if (!input.notes.trim()) return { ok: false, error: "Reviewer notes are required" };
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  
  const objectIds = input.ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  if (objectIds.length === 0) return { ok: true, count: 0 };
  
  const docs = (await cols.templates
    .find({
      _id: { $in: objectIds },
      workspaceId: session.workspaceId,
      status: "submitted",
    })
    .toArray()) as ApprovalTemplateDoc[];
  if (docs.length === 0) return { ok: true, count: 0 };

  await Promise.all(
    docs.map((d) =>
      cols.templates.updateOne(
        { _id: d._id! },
        {
          $set: {
            status: "rejected" as SabsmsTemplateStatus,
            reviewerNotes: input.notes.trim(),
            updatedAt: now,
          },
          $push: {
            approvalHistory: {
              at: now,
              kind: "rejected" as const,
              reviewerId: session.reviewerId,
              notes: input.notes.trim(),
              reasonCode: input.reasonCode,
            } as never,
          },
        },
      ),
    ),
  );
  revalidatePath("/sabsms/templates/approvals");
  revalidatePath("/sabsms/templates");
  return { ok: true, count: docs.length };
}

export async function runAutomatedApprovals(rules: Record<string, string>): Promise<ApprovalResult & { count?: number }> {
  const session = await resolveSession();
  if (!session.ok) return session;
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  
  const docs = (await cols.templates
    .find({
      workspaceId: session.workspaceId,
      status: "submitted",
    })
    .toArray()) as ApprovalTemplateDoc[];
    
  let approvedCount = 0;
  
  for (const doc of docs) {
    const patternStr = rules[doc.category];
    if (!patternStr) continue;
    
    let regex: RegExp;
    try {
      regex = new RegExp(patternStr, "i");
    } catch {
      continue;
    }
    
    // Check if any body matches the regex
    const matches = doc.bodies.some(body => regex.test(body.content));
    if (matches) {
      await cols.templates.updateOne(
        { _id: doc._id! },
        {
          $set: {
            status: "approved" as SabsmsTemplateStatus,
            reviewerNotes: "Auto-approved based on regex rule.",
            updatedAt: now,
            lastApprovedBodies: doc.bodies,
            lastApprovedAt: now,
          },
          $push: {
            approvalHistory: {
              at: now,
              kind: "approved" as const,
              reviewerId: session.reviewerId,
              notes: "Auto-approved based on regex rule.",
              reasonCode: "auto_rule",
            } as never,
          },
        }
      );
      approvedCount++;
    }
  }
  
  if (approvedCount > 0) {
    revalidatePath("/sabsms/templates/approvals");
    revalidatePath("/sabsms/templates");
  }
  return { ok: true, count: approvedCount };
}
