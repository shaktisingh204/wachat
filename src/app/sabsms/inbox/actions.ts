"use server";

/**
 * SabSMS inbox — server actions.
 *
 * Every mutation the 3-pane helpdesk UI triggers lives here. Reads stay
 * in `loadConversations` / `loadThread` so the page-level server
 * component can call them straight from the request handler. Writes are
 * exposed as `"use server"` functions for the client panes.
 *
 * All work is scoped by `workspaceId` (resolved from
 * `getCachedSession()`). The Rust SabSMS engine owns the outbound write
 * path — `replyToThread` calls `sabsmsEngine.enqueueSend(...)` and then
 * stamps `conversationId` onto the engine-written doc with a follow-up
 * `messages.updateOne`. Inbound messages are written by the carrier
 * webhook → engine path; this module only reads them.
 */

import { createHash } from "node:crypto";
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
import type {
  SabsmsConversation,
  SabsmsConversationStatus,
  SabsmsMessage,
} from "@/lib/sabsms/types";

import type {
  InboxAgent,
  InboxConversationView,
  InboxFilters,
  InboxMessageView,
  InboxTemplateView,
  InboxThreadView,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

function toIso(d?: Date | string): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString();
}

function hashPhone(phone: string): string {
  return createHash("sha256")
    .update(phone.trim().toLowerCase())
    .digest("hex");
}

function projectConversation(
  doc: SabsmsConversation & { _id?: ObjectId; notes?: unknown[]; firstResponseAt?: Date },
): InboxConversationView {
  return {
    id: String(doc._id),
    contactId: doc.contactId,
    status: doc.status,
    unreadCount: doc.unreadCount ?? 0,
    assignedAgentId: doc.assignedAgentId ?? null,
    labels: doc.labels ?? [],
    lastMessagePreview: doc.lastMessagePreview,
    lastMessageAt: toIso(doc.lastMessageAt),
    snoozedUntil: toIso(doc.snoozedUntil),
    firstResponseAt: toIso(doc.firstResponseAt),
    createdAt: toIso(doc.createdAt),
  };
}

function projectMessage(
  doc: SabsmsMessage & {
    _id?: ObjectId;
    isNote?: boolean;
    reactions?: string[];
  },
): InboxMessageView {
  return {
    id: String(doc._id),
    direction: doc.direction,
    from: doc.from,
    to: doc.to,
    body: doc.body,
    status: doc.status,
    mediaIds: (doc.media ?? []).map((m) => m.sabFileId),
    reactions: doc.reactions ?? [],
    isNote: Boolean(doc.isNote),
    createdAt: toIso(doc.createdAt),
    sentAt: toIso(doc.sentAt),
    deliveredAt: toIso(doc.deliveredAt),
    errorMessage: doc.errorMessage,
  };
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadConversations(
  workspaceId: string,
  filters: InboxFilters,
): Promise<InboxConversationView[]> {
  const { db } = await connectToDatabase();
  const col = db.collection<SabsmsConversation>(
    SABSMS_COLLECTIONS.conversations,
  );

  const filter: Filter<SabsmsConversation> = { workspaceId };
  const scope = filters.scope ?? "all";

  if (scope === "closed") filter.status = "closed";
  else if (scope === "snoozed") filter.status = "snoozed";
  else if (scope === "all") filter.status = { $in: ["open", "snoozed"] };
  else if (scope === "unassigned") {
    filter.status = "open";
    // Match docs where assignedAgentId is missing or null.
    (filter as Record<string, unknown>).$or = [
      { assignedAgentId: { $exists: false } },
      { assignedAgentId: null },
    ];
  } else if (scope === "mine") {
    filter.status = "open";
    // TODO: thread the current user id through and match it here. For
    // now "mine" returns assigned-to-anyone open conversations.
    filter.assignedAgentId = { $exists: true, $ne: null } as never;
  }

  if (filters.status && filters.status.length > 0) {
    filter.status = { $in: filters.status as SabsmsConversationStatus[] };
  }
  if (filters.labels && filters.labels.length > 0) {
    filter.labels = { $in: filters.labels };
  }
  if (filters.from || filters.to) {
    const lastMessageAt: Record<string, Date> = {};
    if (filters.from) lastMessageAt.$gte = new Date(filters.from);
    if (filters.to) lastMessageAt.$lte = new Date(filters.to);
    filter.lastMessageAt = lastMessageAt as never;
  }
  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    (filter as Record<string, unknown>).$or = [
      ...(((filter as Record<string, unknown>).$or as unknown[]) ?? []),
      { lastMessagePreview: rx },
      { contactId: rx },
    ];
  }

  const sortMap: Record<NonNullable<InboxFilters["sort"]>, Record<string, 1 | -1>> = {
    newest: { lastMessageAt: -1 },
    oldest: { lastMessageAt: 1 },
    unread: { unreadCount: -1, lastMessageAt: -1 },
  };
  const sort = sortMap[filters.sort ?? "newest"];

  const docs = await col
    .find(filter)
    .sort(sort)
    .limit(200)
    .toArray();

  return docs.map((d) => projectConversation(d as never));
}

export async function loadThread(
  workspaceId: string,
  conversationId: string,
): Promise<InboxThreadView | null> {
  if (!ObjectId.isValid(conversationId)) return null;
  const { db } = await connectToDatabase();
  const conv = await db
    .collection<SabsmsConversation>(SABSMS_COLLECTIONS.conversations)
    .findOne({ _id: new ObjectId(conversationId), workspaceId });
  if (!conv) return null;

  const msgs = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find({ workspaceId, conversationId })
    .sort({ createdAt: 1 })
    .limit(500)
    .toArray();

  return {
    conversation: projectConversation(conv as never),
    messages: msgs.map((m) => projectMessage(m as never)),
  };
}

export async function loadTemplates(
  workspaceId: string,
): Promise<InboxTemplateView[]> {
  const { cols } = await getSabsmsCollections();
  const docs = await cols.templates
    .find({ workspaceId, status: "approved" })
    .sort({ name: 1 })
    .limit(50)
    .toArray();
  return docs.map((t) => ({
    id: String(t._id),
    name: t.name,
    body: t.bodies?.[0]?.body ?? "",
  }));
}

export async function loadAgents(
  _workspaceId: string,
): Promise<InboxAgent[]> {
  // TODO: when the agent/team collection ships, swap this for a real
  // lookup. For now the page renders a stubbed pool so the assignment
  // dropdown works end-to-end.
  return [
    { id: "agent.me", name: "Me" },
    { id: "agent.support", name: "Support team" },
    { id: "agent.sales", name: "Sales team" },
  ];
}

// ─── Mutation results ─────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── Composer ─────────────────────────────────────────────────────────────

export async function replyToThread(input: {
  conversationId: string;
  body: string;
  mediaSabFileIds?: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.body?.trim()) return { ok: false, error: "Reply cannot be empty" };
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }

  const { cols } = await getSabsmsCollections();
  const conv = await cols.conversations.findOne({
    _id: new ObjectId(input.conversationId),
    workspaceId: ws.workspaceId,
  });
  if (!conv) return { ok: false, error: "Conversation not found" };

  // Look up the last inbound message to know which carrier number to
  // reply from / send to.
  const lastInbound = await cols.messages.findOne(
    {
      workspaceId: ws.workspaceId,
      conversationId: input.conversationId,
      direction: "inbound",
    },
    { sort: { createdAt: -1 } },
  );
  const to = lastInbound?.from;
  const from = lastInbound?.to;
  if (!to) {
    return { ok: false, error: "No inbound message to reply to" };
  }

  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to,
      from,
      body: input.body,
      category: "service",
      contactId: conv.contactId,
      media: input.mediaSabFileIds?.map((id) => ({
        sabFileId: id,
        mime: "application/octet-stream",
        bytes: 0,
      })),
      eventKey: "sabsms.inbox.reply",
    });

    // The engine writes the outbound document; stamp the conversation
    // link onto it so the thread query picks it up.
    if (res.id && ObjectId.isValid(res.id)) {
      await cols.messages.updateOne(
        { _id: new ObjectId(res.id) },
        {
          $set: {
            conversationId: input.conversationId,
            updatedAt: new Date(),
          },
        },
      );
    }

    const now = new Date();
    await cols.conversations.updateOne(
      { _id: new ObjectId(input.conversationId) },
      {
        $set: {
          lastMessagePreview: input.body.slice(0, 160),
          lastMessageAt: now,
          updatedAt: now,
          ...((conv as unknown as { firstResponseAt?: Date }).firstResponseAt
            ? {}
            : ({ firstResponseAt: now } as Record<string, unknown>)),
        },
        $inc: { unreadCount: -conv.unreadCount },
      },
    );

    return { ok: true, id: res.id };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "send failed" };
  }
}

export async function sendCannedResponse(input: {
  conversationId: string;
  templateId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { cols } = await getSabsmsCollections();
  if (!ObjectId.isValid(input.templateId)) {
    return { ok: false, error: "Invalid templateId" };
  }
  const tpl = await cols.templates.findOne({
    _id: new ObjectId(input.templateId),
  });
  if (!tpl) return { ok: false, error: "Template not found" };
  const body = tpl.bodies?.[0]?.body;
  if (!body) return { ok: false, error: "Template has no body" };
  return replyToThread({ conversationId: input.conversationId, body });
}

// ─── Notes / assign / status ──────────────────────────────────────────────

export async function addInternalNote(input: {
  conversationId: string;
  body: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.body?.trim()) return { ok: false, error: "Note cannot be empty" };
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }

  const { cols } = await getSabsmsCollections();
  const conv = await cols.conversations.findOne({
    _id: new ObjectId(input.conversationId),
    workspaceId: ws.workspaceId,
  });
  if (!conv) return { ok: false, error: "Conversation not found" };

  // Notes are persisted as message documents flagged `isNote: true` —
  // they share the same indexes + thread query as real messages but
  // never leave SabNode.
  const now = new Date();
  await cols.messages.insertOne({
    workspaceId: ws.workspaceId,
    direction: "outbound",
    channel: conv.channel,
    from: "internal",
    to: conv.contactId,
    body: input.body,
    category: "service",
    status: "sent",
    provider: "twilio",
    conversationId: input.conversationId,
    contactId: conv.contactId,
    createdAt: now,
    updatedAt: now,
    // Note flag — the field is non-canonical but persists alongside
    // the message doc and is filtered in the UI layer.
    ...({ isNote: true } as Record<string, unknown>),
  } as unknown as SabsmsMessage);

  return { ok: true };
}

export async function assignTo(input: {
  conversationId: string;
  agentId: string | null;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    {
      $set: {
        assignedAgentId: input.agentId ?? undefined,
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export async function snoozeUntil(input: {
  conversationId: string;
  until: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const until = new Date(input.until);
  if (Number.isNaN(until.getTime())) {
    return { ok: false, error: "Invalid snooze date" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    {
      $set: {
        status: "snoozed",
        snoozedUntil: until,
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true };
}

export async function closeConversation(input: {
  conversationId: string;
  reason: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.reason?.trim()) {
    return { ok: false, error: "Close reason is required" };
  }
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    {
      $set: {
        status: "closed",
        updatedAt: new Date(),
        ...({ closeReason: input.reason.trim() } as Record<string, unknown>),
      },
    },
  );
  return { ok: true };
}

export async function reopenConversation(input: {
  conversationId: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    {
      $set: { status: "open", updatedAt: new Date() },
      $unset: { snoozedUntil: "" },
    },
  );
  return { ok: true };
}

export async function mergeConversations(input: {
  intoId: string;
  fromId: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (input.intoId === input.fromId) {
    return { ok: false, error: "Cannot merge a conversation into itself" };
  }
  if (!ObjectId.isValid(input.intoId) || !ObjectId.isValid(input.fromId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  const [into, from] = await Promise.all([
    cols.conversations.findOne({
      _id: new ObjectId(input.intoId),
      workspaceId: ws.workspaceId,
    }),
    cols.conversations.findOne({
      _id: new ObjectId(input.fromId),
      workspaceId: ws.workspaceId,
    }),
  ]);
  if (!into || !from) {
    return { ok: false, error: "Source or destination conversation missing" };
  }

  // Keep the older convo, fold everything into it.
  const olderId = (into.createdAt ?? new Date()) <= (from.createdAt ?? new Date())
    ? input.intoId
    : input.fromId;
  const newerId = olderId === input.intoId ? input.fromId : input.intoId;

  await cols.messages.updateMany(
    { workspaceId: ws.workspaceId, conversationId: newerId },
    { $set: { conversationId: olderId, updatedAt: new Date() } },
  );
  await cols.conversations.updateOne(
    { _id: new ObjectId(olderId) },
    {
      $set: { updatedAt: new Date() },
      $addToSet: { labels: { $each: from.labels ?? [] } as never },
    },
  );
  await cols.conversations.deleteOne({ _id: new ObjectId(newerId) });
  return { ok: true };
}

// ─── Labels ───────────────────────────────────────────────────────────────

export async function addLabel(input: {
  conversationId: string;
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Label cannot be empty" };
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    { $addToSet: { labels: label }, $set: { updatedAt: new Date() } },
  );
  return { ok: true };
}

export async function removeLabel(input: {
  conversationId: string;
  label: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(input.conversationId), workspaceId: ws.workspaceId },
    { $pull: { labels: input.label }, $set: { updatedAt: new Date() } },
  );
  return { ok: true };
}

// ─── Reactions ────────────────────────────────────────────────────────────

export async function addReaction(input: {
  messageId: string;
  emoji: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(input.messageId)) {
    return { ok: false, error: "Invalid messageId" };
  }
  const emoji = input.emoji.trim();
  if (!emoji) return { ok: false, error: "Emoji cannot be empty" };
  const { cols } = await getSabsmsCollections();
  await cols.messages.updateOne(
    { _id: new ObjectId(input.messageId), workspaceId: ws.workspaceId },
    {
      $addToSet: { reactions: emoji } as never,
      $set: { updatedAt: new Date() },
    },
  );
  return { ok: true };
}

// ─── Suppression + segments ───────────────────────────────────────────────

export async function addToSuppression(input: {
  phone: string;
  reason?: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.phone?.trim()) {
    return { ok: false, error: "Phone is required" };
  }
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
    source: "sabsms.inbox",
    metadata: { reason: input.reason ?? null },
    createdAt: now,
  });

  return { ok: true };
}

export async function addToSegment(_input: {
  contactId: string;
  segmentId: string;
}): Promise<ActionResult> {
  // TODO: Segments ship in Phase 18 — when the segments collection
  // lands, swap this for a real upsert against the membership doc.
  return { ok: false, error: "Segments ship in Phase 18" };
}

// ─── Misc ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
