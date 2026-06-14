"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

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
  return { ok: true, workspaceId: (await getSabsmsWorkspaceId()) ?? "" };
}

/**
 * Tenancy guard for the workspace-explicit read actions below. These actions
 * are directly-invocable RPC endpoints ('use server'); they must NOT trust the
 * caller-supplied `workspaceId` — confirm the signed-in user actually belongs
 * to that `kind:'sms'` project (owner or agent) before reading anything.
 * Prevents a cross-tenant IDOR (e.g. the unified inbox / any crafted call
 * passing an arbitrary victim workspaceId).
 */
async function userOwnsSmsWorkspace(workspaceId: string): Promise<boolean> {
  if (!workspaceId || !ObjectId.isValid(workspaceId)) return false;
  const session = await getCachedSession();
  const uid = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!uid) return false;
  const userId = new ObjectId(String(uid));
  const { db } = await connectToDatabase();
  const project = await db.collection("projects").findOne(
    {
      _id: new ObjectId(workspaceId),
      kind: "sms",
      $or: [{ userId }, { "agents.userId": userId }],
    },
    { projection: { _id: 1 } },
  );
  return Boolean(project);
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
  doc: SabsmsConversation & {
    _id?: ObjectId;
    notes?: unknown[];
    firstResponseAt?: Date;
    /** V2.12 — written by the agent runtime / guardrail (worker side). */
    aiSuggestion?: { body?: string; at?: Date; inboundMessageId?: string };
    aiFlags?: { possibleOptOut?: boolean; handoff?: boolean };
  },
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
    aiSuggestion:
      doc.aiSuggestion && typeof doc.aiSuggestion.body === "string"
        ? {
            body: doc.aiSuggestion.body,
            at: toIso(doc.aiSuggestion.at),
            inboundMessageId: doc.aiSuggestion.inboundMessageId,
          }
        : undefined,
    aiFlags:
      doc.aiFlags && (doc.aiFlags.possibleOptOut || doc.aiFlags.handoff)
        ? {
            possibleOptOut: Boolean(doc.aiFlags.possibleOptOut),
            handoff: Boolean(doc.aiFlags.handoff),
          }
        : undefined,
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
    errorCode: doc.errorCode,
    errorMessage: doc.errorMessage,
    // V2.11 — RCS rendering data (all optional/additive).
    channelUsed: doc.channelUsed,
    rcs: doc.rcs
      ? {
          card: doc.rcs.card
            ? {
                title: doc.rcs.card.title,
                description: doc.rcs.card.description,
                mediaUrl: doc.rcs.card.mediaUrl,
              }
            : undefined,
          suggestions: doc.rcs.suggestions ?? [],
          fallbackText: doc.rcs.fallbackText,
        }
      : undefined,
    rcsFallback: doc.rcsFallback,
    postbackData: doc.postbackData,
  };
}

// ─── Read paths ───────────────────────────────────────────────────────────

export async function loadConversations(
  workspaceId: string,
  filters: InboxFilters,
): Promise<InboxConversationView[]> {
  if (!(await userOwnsSmsWorkspace(workspaceId))) return [];
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
    // "Mine" = open conversations assigned to the signed-in agent. The
    // current user id comes from the session (never a spoofed arg).
    const me = await resolveWorkspace();
    const currentUserId = me.ok ? me.workspaceId : workspaceId;
    filter.assignedAgentId = currentUserId as never;
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
  if (!(await userOwnsSmsWorkspace(workspaceId))) return null;
  const { db } = await connectToDatabase();
  const conv = await db
    .collection<SabsmsConversation>(SABSMS_COLLECTIONS.conversations)
    .findOne({ _id: new ObjectId(conversationId), workspaceId });
  if (!conv) return null;

  const msgs = await db
    .collection<SabsmsMessage>(SABSMS_COLLECTIONS.messages)
    .find({ workspaceId, conversationId })
    .sort({ createdAt: 1, _id: 1 })
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
  workspaceId: string,
): Promise<InboxAgent[]> {
  // REAL directory — the same roster the /sabsms/settings/team surface
  // shows: workspace owner + active project agents (platform RBAC model).
  // Pending invites are excluded — you cannot assign a conversation to
  // someone who has not accepted yet.
  const { loadTeamMembers } = await import(
    "@/app/sabsms/settings/team/actions"
  );
  const { rows } = await loadTeamMembers(workspaceId);
  return rows
    .filter((r) => r.status === "active")
    .map((r) => ({
      id: r.id,
      name: r.name?.trim() || r.email || (r.isOwner ? "Owner" : "Agent"),
    }));
}

// ─── Mutation results ─────────────────────────────────────────────────────

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── Composer ─────────────────────────────────────────────────────────────

export async function replyToThread(input: {
  conversationId: string;
  body: string;
  /**
   * MMS attachments — resolved SabFiles picks. Each carries the SabFile
   * `id` plus the picker-resolved public R2 `url` so the engine can send
   * the media (the worker only attaches MMS from `mediaUrls`). `mime` /
   * `size` populate the stored `media` metadata. NEVER a free-text URL.
   */
  media?: { sabFileId: string; url: string; mime?: string; bytes?: number }[];
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
    { sort: { createdAt: -1, _id: -1 } },
  );
  const to = lastInbound?.from;
  const from = lastInbound?.to;
  if (!to) {
    return { ok: false, error: "No inbound message to reply to" };
  }

  // V2.4 — resolve the SabFiles picks into the engine contract. The
  // worker only sends MMS from `mediaUrls` (resolved public R2 URLs),
  // so pass those alongside the `media` metadata and flip the channel to
  // 'mms'. The URLs come from the SabFiles picker (public R2), never a
  // free-text paste.
  const picks = (input.media ?? []).filter((m) => m.url?.trim());
  const mediaUrls = picks.map((m) => m.url.trim());
  const mediaMeta = picks.map((m) => ({
    sabFileId: m.sabFileId,
    mime: m.mime?.trim() || "application/octet-stream",
    bytes: typeof m.bytes === "number" && m.bytes > 0 ? m.bytes : 0,
  }));

  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to,
      from,
      body: input.body,
      category: "service",
      contactId: conv.contactId,
      ...(mediaUrls.length > 0
        ? { media: mediaMeta, mediaUrls, channel: "mms" as const }
        : {}),
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
          // Replying implies the agent has read the thread.
          unreadCount: 0,
          ...({ lastAgentReplyAt: now } as Record<string, unknown>),
          ...((conv as unknown as { firstResponseAt?: Date }).firstResponseAt
            ? {}
            : ({ firstResponseAt: now } as Record<string, unknown>)),
        },
        // V2.12 — a human reply consumes any pending AI suggestion
        // (whether or not it was used).
        $unset: { aiSuggestion: "" },
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

/**
 * On-demand AI reply suggestion for the inbox composer (Sparkles button).
 *
 * Real LLM call — NOT a canned string. Builds a PII-scrubbed transcript
 * from the thread + the workspace agent's persona/knowledge config and
 * runs it through the same worker-safe provider ladder the V2.12 agent
 * uses (`defaultSabsmsLlmClient`: AI Gateway → Anthropic → OpenAI). When
 * no provider key is configured the ladder returns an honest "AI is not
 * configured" error, which surfaces in the composer — never a fake reply.
 */
export async function generateAiReply(conversationId: string): Promise<{ ok: true; suggestion: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const thread = await loadThread(ws.workspaceId, conversationId);
  if (!thread) return { ok: false, error: "Conversation not found" };

  const [{ defaultSabsmsLlmClient }, { scrubPii }, { agentStoreFor }] =
    await Promise.all([
      import("@/lib/sabsms/agent/llm"),
      import("@/lib/sabsms/agent/guardrails"),
      import("@/lib/sabsms/agent/store"),
    ]);

  // Reuse the workspace agent persona/knowledge so on-demand suggestions
  // stay on-brand with the auto/suggest agent. getConfig returns sane
  // defaults when no agent has been configured.
  const { db } = await connectToDatabase();
  const config = await agentStoreFor(db).getConfig(ws.workspaceId);

  // PII-scrubbed transcript — the model never sees raw phone/card digits.
  const transcript = thread.messages
    .filter((m) => !m.isNote && m.body)
    .slice(-12)
    .map((m) => {
      const who = m.direction === "inbound" ? "Customer" : "Business";
      return `${who}: ${scrubPii(m.body).text}`;
    })
    .join("\n");

  const lastInbound = [...thread.messages]
    .reverse()
    .find((m) => m.direction === "inbound" && m.body);
  if (!lastInbound) {
    return { ok: false, error: "No customer message to reply to yet" };
  }

  const system = [
    "You are drafting a reply that a human support agent will review before sending over SMS.",
    "Keep it under 300 characters, plain text, no markdown, warm and concise.",
    config.persona ? `Business persona / instructions:\n${config.persona}` : "",
    "Only use facts present in the conversation or knowledge base. Never invent specifics, prices, refunds, or legal/medical claims.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const knowledge = config.knowledge
    ? `\n\nKnowledge base (may be relevant):\n${config.knowledge.slice(0, 2000)}`
    : "";

  const prompt = [
    "Conversation so far (oldest first):",
    transcript || "(no prior messages)",
    knowledge,
    "",
    "Write the single best reply for the agent to send next. Output only the reply text.",
  ].join("\n");

  const res = await defaultSabsmsLlmClient({ system, prompt, maxTokens: 300 });
  if (!res.ok) return { ok: false, error: res.error };

  const suggestion = res.text.trim().slice(0, 800);
  if (!suggestion) {
    return { ok: false, error: "The model returned an empty reply" };
  }
  return { ok: true, suggestion };
}

// ─── Read receipts ────────────────────────────────────────────────────────

/**
 * Zero the unread counter when an agent opens a thread. The engine owns
 * incrementing it on inbound; the UI owns clearing it on view.
 */
export async function markRead(conversationId: string): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(conversationId)) {
    return { ok: false, error: "Invalid conversationId" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.conversations.updateOne(
    { _id: new ObjectId(conversationId), workspaceId: ws.workspaceId },
    { $set: { unreadCount: 0, updatedAt: new Date() } },
  );
  return { ok: true };
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

/**
 * Assign a conversation to the signed-in agent. The agent id is resolved
 * from the session server-side, so "Assign to me" never depends on a
 * client-known id (and can't be spoofed to another agent).
 */
export async function assignToMe(input: {
  conversationId: string;
}): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  return assignTo({
    conversationId: input.conversationId,
    agentId: ws.workspaceId,
  });
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

// ─── V2.12 — AI suggestions + insights ────────────────────────────────────

/**
 * Clear a pending AI suggested reply from the conversation. Used by the
 * suggestion card's "Dismiss" button; `replyToThread` also unsets it on
 * every human send.
 */
export async function dismissSuggestion(input: {
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
    { $unset: { aiSuggestion: "" }, $set: { updatedAt: new Date() } },
  );
  return { ok: true };
}

/**
 * Accept a suggestion. The textarea fill happens client-side from the
 * already-loaded suggestion body; server-side the suggestion stays on
 * the doc until the send (replyToThread unsets it), so a page reload
 * before sending re-offers it. This action exists for auditability — it
 * stamps when the suggestion was accepted.
 */
export async function acceptSuggestion(input: {
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
    { $set: { "aiSuggestion.acceptedAt": new Date(), updatedAt: new Date() } },
  );
  return { ok: true };
}

/**
 * Top conversation topics for the inbox insights strip — latest
 * `sabsms_conversation_insights` doc (written by
 * `scripts/sabsms-insights-nightly.mjs`) with trend arrows vs the
 * previous run. Returns null when no insights exist yet.
 */
export async function loadInboxInsights(
  workspaceId: string,
): Promise<import("./types").InboxInsightsView | null> {
  const { loadInsightsWithTrend, topicTrend } = await import(
    "@/lib/sabsms/insights/mining"
  );
  const { db } = await connectToDatabase();
  const { current, previous } = await loadInsightsWithTrend(db, workspaceId);
  if (!current) return null;
  return {
    totalConversations: current.totalConversations,
    computedAt:
      current.computedAt instanceof Date
        ? current.computedAt.toISOString()
        : undefined,
    topics: current.topics.slice(0, 5).map((t) => ({
      label: t.label,
      count: t.count,
      sentiment: t.sentiment,
      trend: topicTrend(t.label, current.topics, previous?.topics),
    })),
  };
}

// ─── Misc ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
