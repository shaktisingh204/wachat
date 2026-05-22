"use server";

/**
 * SabSMS contact detail — server actions + read paths.
 *
 * The detail page loads the full message thread, consent log timeline,
 * engagement metrics, drip and campaign memberships, and any linked
 * CRM/SabWa/Wachat handles. It also exposes the 20 page-unique
 * mutations (add note, custom fields, suppression, GDPR export, etc.).
 */

import { randomUUID } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";

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
  computeRiskScore,
  countryFromPhone,
  engagementScore,
  hashPhone,
} from "../helpers";

export { computeRiskScore } from "../helpers";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface ContactDetailNote {
  id: string;
  body: string;
  authorId?: string;
  createdAt: string;
}

export interface ContactDetailMessage {
  id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string;
  body: string;
  status: string;
  segments?: number;
  cost?: number;
  conversationId?: string;
  campaignId?: string;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  createdAt?: string;
}

export interface ContactDetailConsentEvent {
  id: string;
  kind: string;
  captureMethod: string;
  source?: string;
  createdAt: string;
}

export interface ContactDetailDripEnrolment {
  id: string;
  dripId: string;
  dripName?: string;
  step: number;
  status: string;
  startedAt?: string;
}

export interface ContactDetailCampaignMembership {
  id: string;
  campaignId: string;
  campaignName?: string;
  status?: string;
  joinedAt?: string;
}

export interface ContactDetailView {
  id: string;
  phone: string;
  phoneHash: string;
  name?: string;
  email?: string;
  country: string;
  tags: string[];
  consent: "single" | "double" | "none" | "opt_out";
  source: string;
  customFields: Record<string, string>;
  timezone?: string;
  locale?: string;
  notes: ContactDetailNote[];
  crmLeadId?: string;
  crmDealId?: string;
  sabwaContactId?: string;
  wachatContactId?: string;
  carrier?: {
    operator?: string;
    country?: string;
    lineType?: string;
  };
  metrics: {
    sent: number;
    delivered: number;
    replied: number;
    clicked: number;
    failed: number;
  };
  engagementScore: number;
  riskScore: number;
  conversationId?: string;
  messages: ContactDetailMessage[];
  consentEvents: ContactDetailConsentEvent[];
  drips: ContactDetailDripEnrolment[];
  campaigns: ContactDetailCampaignMembership[];
  createdAt?: string;
  updatedAt?: string;
}

interface RawContactDoc {
  _id?: ObjectId;
  workspaceId?: string;
  phone?: string;
  waId?: string;
  name?: string;
  email?: string;
  tags?: string[];
  notes?: ContactDetailNote[];
  customFields?: Record<string, string>;
  timezone?: string;
  locale?: string;
  source?: string;
  crmLeadId?: string;
  crmDealId?: string;
  sabwaContactId?: string;
  wachatContactId?: string;
  carrier?: ContactDetailView["carrier"];
  createdAt?: Date;
  updatedAt?: Date;
}

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

async function isAdmin(): Promise<boolean> {
  const session = await getCachedSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "admin" || role === "owner";
}

function isoOrUndef(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

// ─── Read path ───────────────────────────────────────────────────────────

export async function loadContactDetail(input: {
  workspaceId: string;
  contactId: string;
}): Promise<ContactDetailView | null> {
  const { db } = await connectToDatabase();
  const { cols } = await getSabsmsCollections();

  let contactDoc: RawContactDoc | null = null;
  let phone: string | undefined;
  let canonicalId: string | undefined;

  if (ObjectId.isValid(input.contactId)) {
    contactDoc = await db
      .collection<RawContactDoc>("contacts")
      .findOne({ _id: new ObjectId(input.contactId) });
    if (contactDoc) {
      phone = contactDoc.phone ?? contactDoc.waId ?? undefined;
      canonicalId = String(contactDoc._id);
    }
  }

  // Fall back to phone-keyed lookup (derived rows).
  if (!phone) {
    phone = input.contactId;
    contactDoc =
      contactDoc ??
      (await db
        .collection<RawContactDoc>("contacts")
        .findOne({
          workspaceId: input.workspaceId,
          phone: input.contactId,
        }));
    if (contactDoc?._id) canonicalId = String(contactDoc._id);
  }

  if (!phone) return null;
  const phoneHash = hashPhone(phone);

  // Messages — by `contactId` OR by `to`/`from` matching the phone, so
  // we work both when canonical contactIds are wired up and when they
  // aren't.
  const msgFilter: Filter<SabsmsMessage> = {
    workspaceId: input.workspaceId,
    $or: [
      { contactId: canonicalId ?? phone },
      { to: phone },
      { from: phone },
    ],
  };
  const msgDocs = await cols.messages
    .find(msgFilter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const messages: ContactDetailMessage[] = msgDocs.map((m) => ({
    id: String(m._id),
    direction: m.direction,
    from: m.from,
    to: m.to,
    body: m.body,
    status: m.status,
    segments: m.segmentsCount,
    cost: m.cost,
    conversationId: m.conversationId,
    campaignId: m.campaignId,
    sentAt: isoOrUndef(m.sentAt),
    deliveredAt: isoOrUndef(m.deliveredAt),
    errorMessage: m.errorMessage,
    createdAt: isoOrUndef(m.createdAt),
  }));

  // Metrics.
  let sent = 0;
  let delivered = 0;
  let replied = 0;
  let failed = 0;
  for (const m of msgDocs) {
    if (m.direction === "inbound") replied += 1;
    else if (m.status === "sent" || m.status === "delivered") sent += 1;
    if (m.status === "delivered") delivered += 1;
    if (m.status === "failed" || m.status === "rejected" || m.status === "undelivered") {
      failed += 1;
    }
  }
  // Clicks: count link clicks tagged to this contact phone.
  const clicks = await cols.linkClicks
    .countDocuments({
      workspaceId: input.workspaceId,
      contactId: canonicalId ?? phone,
    })
    .catch(() => 0);

  // Conversation.
  const conv = await cols.conversations.findOne({
    workspaceId: input.workspaceId,
    contactId: canonicalId ?? phone,
  });
  const conversationId = conv ? String(conv._id) : undefined;

  // Consent log.
  const consentDocs = await cols.consentLog
    .find({ workspaceId: input.workspaceId, phoneHash })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const consentEvents: ContactDetailConsentEvent[] = consentDocs.map((c) => ({
    id: String(c._id),
    kind: c.kind,
    captureMethod: c.captureMethod,
    source: c.source,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  }));
  let consent: ContactDetailView["consent"] = "none";
  const lastConsent = consentDocs[0]?.kind;
  if (lastConsent === "opt_out_stop" || lastConsent === "opt_out_manual" ||
      lastConsent === "opt_out_complaint" || lastConsent === "opt_out_carrier_block") {
    consent = "opt_out";
  } else if (lastConsent === "opt_in_double") {
    consent = "double";
  } else if (lastConsent === "opt_in_single" || lastConsent === "opt_in_restart") {
    consent = "single";
  }

  // Drips — read enrolments collection if it exists, else empty.
  let drips: ContactDetailDripEnrolment[] = [];
  try {
    const dripCol = db.collection<{
      _id: ObjectId;
      dripId: string;
      contactId: string;
      step?: number;
      status?: string;
      startedAt?: Date;
    }>("sabsms_drip_enrolments");
    const raw = await dripCol
      .find({
        workspaceId: input.workspaceId,
        contactId: canonicalId ?? phone,
      } as Filter<{ workspaceId: string; contactId: string }> as never)
      .limit(50)
      .toArray();
    drips = raw.map((d) => ({
      id: String(d._id),
      dripId: d.dripId,
      step: d.step ?? 0,
      status: d.status ?? "active",
      startedAt: isoOrUndef(d.startedAt),
    }));
  } catch {
    // collection may not exist yet
  }

  // Campaigns — derived from message campaignIds.
  const seenCampaignIds = new Set<string>();
  for (const m of msgDocs) if (m.campaignId) seenCampaignIds.add(m.campaignId);
  let campaigns: ContactDetailCampaignMembership[] = [];
  if (seenCampaignIds.size > 0) {
    const ids = Array.from(seenCampaignIds)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (ids.length > 0) {
      const docs = await cols.campaigns
        .find({ _id: { $in: ids } } as never)
        .limit(50)
        .toArray();
      campaigns = docs.map((d) => ({
        id: String(d._id),
        campaignId: String(d._id),
        campaignName: d.name,
        status: d.status,
        joinedAt: isoOrUndef(d.createdAt),
      }));
    }
  }

  const country = countryFromPhone(phone);
  const score = engagementScore({ sent, delivered, replied, failed });
  const complaintCount = consentDocs.filter(
    (c) => c.kind === "opt_out_complaint",
  ).length;
  const riskScore = computeRiskScore({ failed, sent, complaints: complaintCount });

  return {
    id: canonicalId ?? phone,
    phone,
    phoneHash,
    name: contactDoc?.name,
    email: contactDoc?.email,
    country,
    tags: contactDoc?.tags ?? [],
    consent,
    source: contactDoc?.source ?? "derived",
    customFields: contactDoc?.customFields ?? {},
    timezone: contactDoc?.timezone,
    locale: contactDoc?.locale,
    notes: contactDoc?.notes ?? [],
    crmLeadId: contactDoc?.crmLeadId,
    crmDealId: contactDoc?.crmDealId,
    sabwaContactId: contactDoc?.sabwaContactId,
    wachatContactId: contactDoc?.wachatContactId,
    carrier: contactDoc?.carrier,
    metrics: { sent, delivered, replied, clicked: clicks, failed },
    engagementScore: score,
    riskScore,
    conversationId,
    messages: messages.slice().reverse(),
    consentEvents,
    drips,
    campaigns,
    createdAt: isoOrUndef(contactDoc?.createdAt),
    updatedAt: isoOrUndef(contactDoc?.updatedAt),
  };
}

// ─── Mini composer ───────────────────────────────────────────────────────

export async function sendMessageFromDetail(input: {
  contactId: string;
  phone: string;
  body: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.body?.trim()) return { ok: false, error: "Body is required" };
  if (!input.phone?.trim()) return { ok: false, error: "Phone is required" };
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: input.phone,
      body: input.body,
      category: "service",
      contactId: input.contactId,
      eventKey: "sabsms.contact_detail.send",
    });
    return { ok: true, id: res.id };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "send failed" };
  }
}

// ─── Notes ───────────────────────────────────────────────────────────────

async function withContactId(input: { contactId: string; workspaceId: string }) {
  const { db } = await connectToDatabase();
  const col = db.collection("contacts");
  if (ObjectId.isValid(input.contactId)) {
    const existing = await col.findOne({ _id: new ObjectId(input.contactId) });
    if (existing) return { col, _id: existing._id, phone: existing.phone as string | undefined };
  }
  // Upsert minimal doc keyed on phone.
  const phone = input.contactId;
  const upserted = await col.findOneAndUpdate(
    { workspaceId: input.workspaceId, phone },
    {
      $setOnInsert: {
        workspaceId: input.workspaceId,
        phone,
        tags: [],
        notes: [],
        customFields: {},
        createdAt: new Date(),
      },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: "after" },
  );
  return { col, _id: upserted?._id, phone };
}

export async function addContactNote(input: {
  contactId: string;
  body: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Note cannot be empty" };

  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    {
      $push: {
        notes: {
          id: randomUUID(),
          body,
          authorId: ws.userId,
          createdAt: new Date().toISOString(),
        } as never,
      },
      $set: { updatedAt: new Date() },
    } as never,
  );
  return { ok: true };
}

// ─── Custom fields ───────────────────────────────────────────────────────

export async function setCustomField(input: {
  contactId: string;
  key: string;
  value: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const key = input.key.trim();
  if (!key) return { ok: false, error: "Field key is required" };
  if (key.length > 64) return { ok: false, error: "Field key too long" };

  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    {
      $set: {
        [`customFields.${key}`]: input.value,
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export async function removeCustomField(input: {
  contactId: string;
  key: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    {
      $unset: { [`customFields.${input.key}`]: "" },
      $set: { updatedAt: new Date() },
    },
  );
  return { ok: true };
}

// ─── Tags ────────────────────────────────────────────────────────────────

export async function setDetailTags(input: {
  contactId: string;
  tags: string[];
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const tags = Array.from(
    new Set(
      input.tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 64),
    ),
  );
  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    { $set: { tags, updatedAt: new Date() } },
  );
  return { ok: true };
}

// ─── Timezone / locale ───────────────────────────────────────────────────

export async function setTimezone(input: {
  contactId: string;
  timezone: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    { $set: { timezone: input.timezone, updatedAt: new Date() } },
  );
  return { ok: true };
}

export async function setLocale(input: {
  contactId: string;
  locale: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { col, _id } = await withContactId({
    contactId: input.contactId,
    workspaceId: ws.workspaceId,
  });
  if (!_id) return { ok: false, error: "Could not resolve contact" };
  await col.updateOne(
    { _id },
    { $set: { locale: input.locale, updatedAt: new Date() } },
  );
  return { ok: true };
}

// ─── Suppression add / remove ────────────────────────────────────────────

export async function addContactToSuppression(input: {
  phone: string;
  reason?: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { cols } = await getSabsmsCollections();
  const phoneHash = hashPhone(input.phone);
  const now = new Date();
  await cols.suppressions.updateOne(
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
  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash,
    kind: "opt_out_manual",
    captureMethod: "api",
    source: "sabsms.contact_detail",
    metadata: { reason: input.reason ?? null },
    createdAt: now,
  });
  return { ok: true };
}

export async function removeContactFromSuppression(input: {
  phone: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!(await isAdmin())) {
    return { ok: false, error: "Only admins can remove suppression entries" };
  }
  const { cols } = await getSabsmsCollections();
  const phoneHash = hashPhone(input.phone);
  await cols.suppressions.deleteOne({
    workspaceId: ws.workspaceId,
    phoneHash,
  });
  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash,
    kind: "opt_in_restart",
    captureMethod: "api",
    source: "sabsms.contact_detail",
    createdAt: new Date(),
  });
  return { ok: true };
}

// ─── GDPR — subject access + erasure ────────────────────────────────────

export interface GdprExportResult {
  ok: true;
  payload: {
    contact: ContactDetailView | null;
    messages: ContactDetailMessage[];
    consentEvents: ContactDetailConsentEvent[];
    exportedAt: string;
  };
}

export async function gdprExportContact(input: {
  contactId: string;
}): Promise<GdprExportResult | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const detail = await loadContactDetail({
    workspaceId: ws.workspaceId,
    contactId: input.contactId,
  });
  if (!detail) return { ok: false, error: "Contact not found" };
  return {
    ok: true,
    payload: {
      contact: detail,
      messages: detail.messages,
      consentEvents: detail.consentEvents,
      exportedAt: new Date().toISOString(),
    },
  };
}

export async function gdprDeleteContact(input: {
  contactId: string;
}): Promise<{ ok: true; erased: number } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const detail = await loadContactDetail({
    workspaceId: ws.workspaceId,
    contactId: input.contactId,
  });
  if (!detail) return { ok: false, error: "Contact not found" };

  const { db } = await connectToDatabase();
  const { cols } = await getSabsmsCollections();

  // Erasure: scrub PII fields in `contacts`, `sabsms_messages`, and
  // `sabsms_conversations` but RETAIN the hashed suppression so future
  // imports remain compliant.
  let erased = 0;
  const placeholder = `gdpr-erased-${detail.phoneHash.slice(0, 12)}`;

  if (ObjectId.isValid(detail.id)) {
    const r = await db.collection("contacts").updateOne(
      { _id: new ObjectId(detail.id) },
      {
        $set: {
          phone: placeholder,
          name: "[erased]",
          email: undefined,
          notes: [],
          customFields: {},
          erasedAt: new Date(),
        },
        $unset: {
          crmLeadId: "",
          crmDealId: "",
          sabwaContactId: "",
          wachatContactId: "",
        },
      },
    );
    erased += r.modifiedCount ?? 0;
  } else {
    await db.collection("contacts").deleteOne({
      workspaceId: ws.workspaceId,
      phone: detail.phone,
    });
  }

  const msgRes = await cols.messages.updateMany(
    {
      workspaceId: ws.workspaceId,
      $or: [{ to: detail.phone }, { from: detail.phone }],
    },
    {
      $set: {
        body: "[erased]",
        to: placeholder,
        from: placeholder,
        erasedAt: new Date(),
      },
    },
  );
  erased += msgRes.modifiedCount ?? 0;

  // Drop conversation but keep hashed suppression.
  await cols.conversations.deleteMany({
    workspaceId: ws.workspaceId,
    contactId: detail.id,
  });
  await cols.suppressions.updateOne(
    { workspaceId: ws.workspaceId, phoneHash: detail.phoneHash },
    {
      $setOnInsert: {
        workspaceId: ws.workspaceId,
        phoneHash: detail.phoneHash,
        source: "manual" as const,
        reason: "GDPR erasure",
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  await cols.consentLog.insertOne({
    workspaceId: ws.workspaceId,
    phoneHash: detail.phoneHash,
    kind: "opt_out_manual",
    captureMethod: "api",
    source: "sabsms.contact_detail.gdpr_erase",
    metadata: { reason: "GDPR erasure" },
    createdAt: new Date(),
  });
  return { ok: true, erased };
}

// Touch the messages type so the symbol stays used.
type _Messages = SabsmsMessage;
const _collectionConst = SABSMS_COLLECTIONS.messages;
void _collectionConst;
