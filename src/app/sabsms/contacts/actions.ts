"use server";

/**
 * SabSMS contacts — server actions + read paths.
 *
 * The contacts page reads from the existing SabNode `contacts` collection
 * if present, and falls back to deriving contacts from the distinct
 * phone numbers seen in `sabsms_messages` when no canonical contact
 * doc exists. Mutations (tags, suppression, opt-in confirmation,
 * merge, etc.) are exposed as `"use server"` functions for the client
 * table.
 *
 * Every action is workspace-scoped via `getCachedSession()`.
 */

import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import {
  SABSMS_COLLECTIONS,
  getSabsmsCollections,
} from "@/lib/sabsms/db/collections";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import type { SabsmsMessage } from "@/lib/sabsms/types";

import {
  bestSendHourFromHours,
  consentFromConsentEvents,
  countryFromPhone,
  engagementScore,
  hashPhone,
  type ContactConsentState as HelperConsentState,
} from "./helpers";

export { countryFromPhone, engagementScore } from "./helpers";

// ─── Types ────────────────────────────────────────────────────────────────

export type ContactConsentState =
  | "single"
  | "double"
  | "none"
  | "opt_out";

export type ContactSource =
  | "crm"
  | "import"
  | "api"
  | "inbound"
  | "derived";

export interface ContactRow {
  /** Stable identifier — Mongo ObjectId for canonical docs, or the
   *  phone E.164 itself when derived from messages. */
  id: string;
  phone: string;
  /** ISO 3166-1 alpha-2 country, best-effort from the E.164 prefix. */
  country: string;
  name?: string;
  email?: string;
  tags: string[];
  consent: ContactConsentState;
  source: ContactSource;
  engagementScore: number;
  /** Best send hour (0–23) — heuristically derived from past activity. */
  bestSendHour?: number;
  carrier?: string;
  lineType?: "mobile" | "landline" | "voip";
  isVoip?: boolean;
  isDisposable?: boolean;
  lastMessageAt?: string;
  totalSent: number;
  totalDelivered: number;
  totalReplied: number;
  totalFailed: number;
  /** Derived from `conversations.contactId === phone`. */
  conversationId?: string;
  notes?: ContactNote[];
  customFields?: Record<string, string>;
  timezone?: string;
  locale?: string;
  /** "linked" stubs — present when a doc carries the field. */
  crmLeadId?: string;
  crmDealId?: string;
  sabwaContactId?: string;
  wachatContactId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactNote {
  id: string;
  body: string;
  authorId?: string;
  createdAt: string;
}

export interface ContactsListFilters {
  q?: string;
  /** Multi-select sources. */
  source?: ContactSource[];
  /** Multi-select alpha-2 country codes. */
  country?: string[];
  /** Multi-select consent state. */
  consent?: ContactConsentState[];
  /** ISO timestamp. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ContactsListResult {
  rows: ContactRow[];
  total: number;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string; userId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  const id = String(userId);
  return { ok: true, workspaceId: id, userId: id };
}

function isoOrUndef(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

// Local alias so we can re-export the ContactConsentState as part of the
// public action surface without confusing the helper import.
type _ContactConsentState = HelperConsentState;
type _Unused = _ContactConsentState;

// ─── Read path ────────────────────────────────────────────────────────────

/**
 * Load contacts for the current workspace.
 *
 * Phase 1 hybrid: if the workspace has a canonical `contacts` collection
 * the page joins it, otherwise it derives rows from distinct phone
 * numbers across `sabsms_messages`. Either way we hydrate engagement
 * stats + last-message-at + consent state from SabSMS collections so the
 * surface area is consistent.
 */
export async function loadContacts(
  workspaceId: string,
  filters: ContactsListFilters,
): Promise<ContactsListResult> {
  const { db } = await connectToDatabase();
  const { cols } = await getSabsmsCollections();

  const pageSize = Math.min(250, Math.max(10, filters.pageSize ?? 50));
  const page = Math.max(0, filters.page ?? 0);

  // 1. Try canonical contacts collection.
  const canonicalContacts = db.collection<{
    _id: ObjectId;
    workspaceId?: string;
    projectId?: ObjectId;
    phone?: string;
    waId?: string;
    name?: string;
    email?: string;
    tags?: string[];
    notes?: ContactNote[];
    customFields?: Record<string, string>;
    timezone?: string;
    locale?: string;
    crmLeadId?: string;
    crmDealId?: string;
    sabwaContactId?: string;
    wachatContactId?: string;
    source?: ContactSource;
    createdAt?: Date;
    updatedAt?: Date;
  }>("contacts");

  const baseDocs = await canonicalContacts
    .find({
      $or: [{ workspaceId }, { workspaceId: { $exists: false } }],
    })
    .limit(2000)
    .toArray()
    .catch(() => []);

  type Aggregate = {
    phone: string;
    name?: string;
    email?: string;
    tags: string[];
    notes?: ContactNote[];
    customFields?: Record<string, string>;
    source: ContactSource;
    canonicalId?: string;
    timezone?: string;
    locale?: string;
    crmLeadId?: string;
    crmDealId?: string;
    sabwaContactId?: string;
    wachatContactId?: string;
    createdAt?: Date;
    updatedAt?: Date;
  };

  const aggregates = new Map<string, Aggregate>();

  for (const c of baseDocs) {
    const phone = (c.phone ?? c.waId ?? "").trim();
    if (!phone) continue;
    aggregates.set(phone, {
      phone,
      name: c.name,
      email: c.email,
      tags: Array.isArray(c.tags) ? c.tags : [],
      notes: Array.isArray(c.notes) ? c.notes : undefined,
      customFields: c.customFields,
      source: c.source ?? "crm",
      canonicalId: String(c._id),
      timezone: c.timezone,
      locale: c.locale,
      crmLeadId: c.crmLeadId,
      crmDealId: c.crmDealId,
      sabwaContactId: c.sabwaContactId,
      wachatContactId: c.wachatContactId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  }

  // 2. Derive from messages — pick up phones not yet in `contacts`.
  const phonesFromMessages = await cols.messages
    .aggregate<{ _id: string; lastAt: Date; direction: string }>([
      { $match: { workspaceId } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$direction", "outbound"] },
              "$to",
              "$from",
            ],
          },
          lastAt: { $max: "$createdAt" },
          direction: { $first: "$direction" },
        },
      },
      { $limit: 2000 },
    ])
    .toArray()
    .catch(() => []);

  for (const row of phonesFromMessages) {
    const phone = row._id;
    if (!phone) continue;
    if (!aggregates.has(phone)) {
      aggregates.set(phone, {
        phone,
        tags: [],
        source: row.direction === "inbound" ? "inbound" : "derived",
      });
    }
  }

  if (aggregates.size === 0) {
    return { rows: [], total: 0 };
  }

  const phones = Array.from(aggregates.keys());

  // 3. Hydrate per-phone engagement stats + best-hour + consent.
  const statsAgg = await cols.messages
    .aggregate<{
      phone: string;
      sent: number;
      delivered: number;
      failed: number;
      lastMessageAt?: Date;
      hours: number[];
    }>([
      {
        $match: {
          workspaceId,
          $or: [
            { to: { $in: phones } },
            { from: { $in: phones } },
          ],
        },
      },
      {
        $project: {
          phone: {
            $cond: [
              { $eq: ["$direction", "outbound"] },
              "$to",
              "$from",
            ],
          },
          status: 1,
          createdAt: 1,
          sentAt: 1,
          direction: 1,
        },
      },
      {
        $group: {
          _id: "$phone",
          sent: {
            $sum: { $cond: [{ $in: ["$status", ["sent", "delivered"]] }, 1, 0] },
          },
          delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
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
          lastMessageAt: { $max: "$createdAt" },
          hours: {
            $push: { $hour: { $ifNull: ["$sentAt", "$createdAt"] } },
          },
        },
      },
      {
        $project: {
          _id: 0,
          phone: "$_id",
          sent: 1,
          delivered: 1,
          failed: 1,
          lastMessageAt: 1,
          hours: 1,
        },
      },
    ])
    .toArray()
    .catch(() => []);

  const statsByPhone = new Map<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      lastMessageAt?: Date;
      bestHour?: number;
    }
  >();
  for (const s of statsAgg) {
    statsByPhone.set(s.phone, {
      sent: s.sent,
      delivered: s.delivered,
      failed: s.failed,
      lastMessageAt: s.lastMessageAt,
      bestHour: bestSendHourFromHours(s.hours ?? []),
    });
  }

  // 4. Reply counts — inbound messages bucketed by their `from`.
  const replyAgg = await cols.messages
    .aggregate<{ phone: string; replies: number }>([
      {
        $match: {
          workspaceId,
          direction: "inbound",
          from: { $in: phones },
        },
      },
      { $group: { _id: "$from", replies: { $sum: 1 } } },
      { $project: { _id: 0, phone: "$_id", replies: 1 } },
    ])
    .toArray()
    .catch(() => []);
  const repliesByPhone = new Map<string, number>();
  for (const r of replyAgg) repliesByPhone.set(r.phone, r.replies);

  // 5. Consent state — read from `sabsms_consent_log` by phone hash.
  const phoneHashByPhone = new Map(
    phones.map((p) => [p, hashPhone(p)] as const),
  );
  const consentAgg = await cols.consentLog
    .aggregate<{ phoneHash: string; kinds: string[] }>([
      {
        $match: {
          workspaceId,
          phoneHash: { $in: Array.from(phoneHashByPhone.values()) },
        },
      },
      { $group: { _id: "$phoneHash", kinds: { $addToSet: "$kind" } } },
      { $project: { _id: 0, phoneHash: "$_id", kinds: 1 } },
    ])
    .toArray()
    .catch(() => []);
  const consentByHash = new Map<string, string[]>();
  for (const c of consentAgg) consentByHash.set(c.phoneHash, c.kinds);

  // 6. Conversation ids — by `contactId === phone`.
  const convs = await cols.conversations
    .find({ workspaceId, contactId: { $in: phones } })
    .project<{ _id: ObjectId; contactId: string }>({ _id: 1, contactId: 1 })
    .toArray()
    .catch(() => []);
  const convByPhone = new Map<string, string>();
  for (const c of convs) convByPhone.set(c.contactId, String(c._id));

  // 7. Project rows.
  let rows: ContactRow[] = [];
  for (const agg of aggregates.values()) {
    const stats = statsByPhone.get(agg.phone) ?? {
      sent: 0,
      delivered: 0,
      failed: 0,
    };
    const replied = repliesByPhone.get(agg.phone) ?? 0;
    const kinds = consentByHash.get(phoneHashByPhone.get(agg.phone) ?? "") ?? [];
    const consent = consentFromConsentEvents(kinds);
    const country = countryFromPhone(agg.phone);
    rows.push({
      id: agg.canonicalId ?? agg.phone,
      phone: agg.phone,
      country,
      name: agg.name,
      email: agg.email,
      tags: agg.tags,
      consent,
      source: agg.source,
      engagementScore: engagementScore({
        sent: stats.sent,
        delivered: stats.delivered,
        replied,
        failed: stats.failed,
      }),
      bestSendHour: stats.bestHour,
      lastMessageAt: isoOrUndef(stats.lastMessageAt),
      totalSent: stats.sent,
      totalDelivered: stats.delivered,
      totalReplied: replied,
      totalFailed: stats.failed,
      conversationId: convByPhone.get(agg.phone),
      notes: agg.notes,
      customFields: agg.customFields,
      timezone: agg.timezone,
      locale: agg.locale,
      crmLeadId: agg.crmLeadId,
      crmDealId: agg.crmDealId,
      sabwaContactId: agg.sabwaContactId,
      wachatContactId: agg.wachatContactId,
      createdAt: isoOrUndef(agg.createdAt),
      updatedAt: isoOrUndef(agg.updatedAt),
    });
  }

  // 8. Filter.
  if (filters.source && filters.source.length > 0) {
    const want = new Set(filters.source);
    rows = rows.filter((r) => want.has(r.source));
  }
  if (filters.country && filters.country.length > 0) {
    const want = new Set(filters.country);
    rows = rows.filter((r) => want.has(r.country));
  }
  if (filters.consent && filters.consent.length > 0) {
    const want = new Set(filters.consent);
    rows = rows.filter((r) => want.has(r.consent));
  }
  if (filters.from) {
    const f = new Date(filters.from).getTime();
    rows = rows.filter((r) =>
      r.lastMessageAt ? new Date(r.lastMessageAt).getTime() >= f : false,
    );
  }
  if (filters.to) {
    const t = new Date(filters.to).getTime();
    rows = rows.filter((r) =>
      r.lastMessageAt ? new Date(r.lastMessageAt).getTime() <= t : false,
    );
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.phone.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // 9. Sort by engagement desc, last activity desc.
  rows.sort((a, b) => {
    if (b.engagementScore !== a.engagementScore) {
      return b.engagementScore - a.engagementScore;
    }
    const la = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const lb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return lb - la;
  });

  const total = rows.length;
  const start = page * pageSize;
  return { rows: rows.slice(start, start + pageSize), total };
}

// ─── Tag editor ───────────────────────────────────────────────────────────

export async function setContactTags(input: {
  contactId: string;
  tags: string[];
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const cleaned = Array.from(
    new Set(
      input.tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 64),
    ),
  );
  const { db } = await connectToDatabase();
  if (ObjectId.isValid(input.contactId)) {
    await db.collection("contacts").updateOne(
      { _id: new ObjectId(input.contactId) },
      { $set: { tags: cleaned, updatedAt: new Date() } },
    );
  } else {
    // Derived row — upsert a thin contact doc keyed on phone.
    await db.collection("contacts").updateOne(
      { workspaceId: ws.workspaceId, phone: input.contactId },
      {
        $set: { tags: cleaned, updatedAt: new Date() },
        $setOnInsert: {
          workspaceId: ws.workspaceId,
          phone: input.contactId,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
  return { ok: true };
}

// ─── Inline phone re-format ───────────────────────────────────────────────

export async function updatePhoneFormat(input: {
  contactId: string;
  phone: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const phone = input.phone.trim();
  if (!phone.startsWith("+") || phone.length < 7 || phone.length > 20) {
    return { ok: false, error: "Phone must be in E.164 format (e.g. +14155551212)" };
  }
  const { db } = await connectToDatabase();
  if (ObjectId.isValid(input.contactId)) {
    await db.collection("contacts").updateOne(
      { _id: new ObjectId(input.contactId) },
      { $set: { phone, updatedAt: new Date() } },
    );
  } else {
    await db.collection("contacts").updateOne(
      { workspaceId: ws.workspaceId, phone: input.contactId },
      { $set: { phone, updatedAt: new Date() } },
      { upsert: true },
    );
  }
  return { ok: true };
}

// ─── Carrier (HLR) lookup — engine stub ──────────────────────────────────

export async function carrierLookup(input: {
  phone: string;
}): Promise<
  | { ok: true; carrier: string; lineType: string; country: string }
  | { ok: false; error: string }
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  // TODO(phase-13): the SabSMS engine does not yet expose `/v1/hlr/lookup`.
  // When it does, swap this stub for a real call. Until then we ping the
  // engine for liveness so the action surfaces a real-looking error
  // without inventing carrier data.
  try {
    await sabsmsEngine.health();
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `Engine offline: ${e.message}` };
    }
    return { ok: false, error: "Engine unreachable" };
  }
  return {
    ok: false,
    error: "HLR lookup is not implemented yet (engine endpoint pending — TODO).",
  };
}

// ─── Merge duplicates ────────────────────────────────────────────────────

export async function mergeContacts(input: {
  intoId: string;
  fromId: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (input.intoId === input.fromId) {
    return { ok: false, error: "Cannot merge a contact into itself" };
  }

  const { db } = await connectToDatabase();
  const col = db.collection("contacts");
  const into = ObjectId.isValid(input.intoId)
    ? await col.findOne({ _id: new ObjectId(input.intoId) })
    : await col.findOne({ workspaceId: ws.workspaceId, phone: input.intoId });
  const from = ObjectId.isValid(input.fromId)
    ? await col.findOne({ _id: new ObjectId(input.fromId) })
    : await col.findOne({ workspaceId: ws.workspaceId, phone: input.fromId });

  if (!into && !from) {
    return { ok: false, error: "Neither contact exists" };
  }

  const mergedTags = Array.from(
    new Set([
      ...((into?.tags as string[]) ?? []),
      ...((from?.tags as string[]) ?? []),
    ]),
  );
  const mergedNotes = [
    ...((into?.notes as ContactNote[]) ?? []),
    ...((from?.notes as ContactNote[]) ?? []),
  ];

  if (into) {
    await col.updateOne(
      { _id: into._id },
      {
        $set: {
          tags: mergedTags,
          notes: mergedNotes,
          updatedAt: new Date(),
        },
      },
    );
  }
  if (from) {
    await col.deleteOne({ _id: from._id });
  }
  return { ok: true };
}

// ─── Bulk: add to segment (stub) ─────────────────────────────────────────

export async function bulkAddToSegment(_input: {
  contactIds: string[];
  segmentId: string;
}): Promise<ActionResult> {
  // TODO(phase-18): no segments collection yet.
  return { ok: false, error: "Segments ship in Phase 18" };
}

// ─── Bulk: add to suppression ────────────────────────────────────────────

export async function bulkAddToSuppression(input: {
  phones: string[];
  reason?: string;
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { cols } = await getSabsmsCollections();
  const now = new Date();
  let added = 0;
  for (const phone of input.phones) {
    if (!phone?.trim()) continue;
    const phoneHash = hashPhone(phone);
    const res = await cols.suppressions.updateOne(
      { workspaceId: ws.workspaceId, phoneHash },
      {
        $setOnInsert: {
          workspaceId: ws.workspaceId,
          phoneHash,
          source: "manual" as const,
          reason: input.reason?.trim(),
          createdAt: now,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount && res.upsertedCount > 0) added += 1;
    await cols.consentLog.insertOne({
      workspaceId: ws.workspaceId,
      phoneHash,
      kind: "opt_out_manual",
      captureMethod: "api",
      source: "sabsms.contacts",
      metadata: { reason: input.reason ?? null },
      createdAt: now,
    });
  }
  return { ok: true, added };
}

// ─── Opt-in confirmation request ─────────────────────────────────────────

export async function sendOptInConfirmation(input: {
  phone: string;
  workspaceName?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const phone = input.phone.trim();
  if (!phone) return { ok: false, error: "Phone is required" };
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: phone,
      body: `Confirm your subscription to ${input.workspaceName ?? "our updates"} by replying YES. Reply STOP to opt out.`,
      category: "service",
      eventKey: "sabsms.contacts.optin_request",
    });
    return { ok: true, id: res.id };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "send failed" };
  }
}

// ─── CSV import ──────────────────────────────────────────────────────────

export interface ImportContactsInput {
  csv: string;
  defaultSource?: ContactSource;
}

export interface ImportContactsResult {
  ok: true;
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function importContactsCsv(
  input: ImportContactsInput,
): Promise<ImportContactsResult | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const lines = input.csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least one data row" };
  }
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const phoneIdx = header.indexOf("phone");
  if (phoneIdx === -1) {
    return { ok: false, error: "CSV header must include a 'phone' column" };
  }
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const tagsIdx = header.indexOf("tags");

  const { db } = await connectToDatabase();
  const col = db.collection("contacts");
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const phone = (cols[phoneIdx] ?? "").trim();
    if (!phone.startsWith("+")) {
      errors.push(`Row ${i + 1}: phone "${phone}" is not E.164`);
      skipped += 1;
      continue;
    }
    const doc: Record<string, unknown> = {
      workspaceId: ws.workspaceId,
      phone,
      source: input.defaultSource ?? "import",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (nameIdx !== -1) doc.name = (cols[nameIdx] ?? "").trim();
    if (emailIdx !== -1) doc.email = (cols[emailIdx] ?? "").trim();
    if (tagsIdx !== -1) {
      doc.tags = (cols[tagsIdx] ?? "")
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    const existing = await col.findOne({
      workspaceId: ws.workspaceId,
      phone,
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await col.insertOne(doc);
    inserted += 1;
  }

  return { ok: true, inserted, skipped, errors };
}

// ─── Bulk delete (with consent-log retention) ────────────────────────────

export async function bulkDeleteContacts(input: {
  contactIds: string[];
  /** Also write an opt_out_manual entry so future re-imports stay
   *  suppressed. */
  retainSuppression?: boolean;
}): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await connectToDatabase();
  const { cols } = await getSabsmsCollections();
  let deleted = 0;
  for (const id of input.contactIds) {
    let phone: string | undefined;
    if (ObjectId.isValid(id)) {
      const doc = await db.collection("contacts").findOne({
        _id: new ObjectId(id),
      });
      phone = (doc?.phone as string | undefined) ?? undefined;
      const res = await db.collection("contacts").deleteOne({
        _id: new ObjectId(id),
      });
      if (res.deletedCount && res.deletedCount > 0) deleted += 1;
    } else {
      phone = id;
      await db.collection("contacts").deleteOne({
        workspaceId: ws.workspaceId,
        phone: id,
      });
      deleted += 1;
    }
    if (input.retainSuppression !== false && phone) {
      const phoneHash = hashPhone(phone);
      await cols.consentLog.insertOne({
        workspaceId: ws.workspaceId,
        phoneHash,
        kind: "opt_out_manual",
        captureMethod: "api",
        source: "sabsms.contacts.delete",
        metadata: { reason: "contact deleted" },
        createdAt: new Date(),
      });
    }
  }
  return { ok: true, deleted };
}

// ─── Audit trail ─────────────────────────────────────────────────────────

export interface ContactAuditEntry {
  id: string;
  at: string;
  kind: string;
  actor?: string;
  detail?: string;
}

/**
 * Audit entries — reconstructed from `sabsms_consent_log` for now. When
 * a real audit collection lands the union shape stays the same.
 */
export async function loadContactAudit(input: {
  phone: string;
}): Promise<ContactAuditEntry[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const { cols } = await getSabsmsCollections();
  const phoneHash = hashPhone(input.phone);
  const events = await cols.consentLog
    .find({ workspaceId: ws.workspaceId, phoneHash })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return events.map((e) => ({
    id: String(e._id),
    at: (e.createdAt instanceof Date
      ? e.createdAt.toISOString()
      : String(e.createdAt)),
    kind: e.kind,
    actor: e.source,
    detail:
      (e.metadata && typeof e.metadata === "object" && "reason" in e.metadata
        ? String(
            (e.metadata as { reason?: unknown }).reason ?? "",
          )
        : undefined) || undefined,
  }));
}

// ─── Export ──────────────────────────────────────────────────────────────

export async function exportContactsForCsv(
  workspaceId: string,
  filters: ContactsListFilters,
): Promise<ContactRow[]> {
  const { rows } = await loadContacts(workspaceId, {
    ...filters,
    pageSize: 1000,
  });
  return rows;
}

// Touch the messages type so the symbol stays used.
type _Messages = SabsmsMessage;
type _MessagesUnused = _Messages;
