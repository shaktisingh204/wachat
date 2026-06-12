/**
 * SabSMS AI agent — persistence layer (V2.12).
 *
 * Narrow store interface in the `JourneyStore` tradition: the runtime
 * and guardrail handlers talk to `AgentStore`, production binds it to
 * Mongo (`createMongoAgentStore`), and tests/the eval harness bind it
 * to the in-memory twin (`createMemoryAgentStore`) so the WHOLE
 * pipeline runs deterministically without infra.
 *
 * Collections owned here:
 *   - `sabsms_agent_configs`  — per-workspace agent settings (unique).
 *   - `sabsms_agent_turns`    — append-only audit of EVERY turn.
 * Plus scoped touches of existing collections: conversations (aiFlags /
 * aiSuggestion / handoff), messages (note insert + thread reads),
 * suppressions, consent log, `contacts` (CRM lookup), and the credits
 * ledger collections (see `chargeAgentTurnCredit`).
 *
 * Credit metering note: the canonical ledger
 * (`src/lib/sabsms/credits/ledger.ts`) is `server-only` + `@/`-coupled,
 * so it cannot load inside the tsx events worker. `chargeAgentTurnCredit`
 * therefore performs the SAME atomic movement against the SAME
 * collections (`users.credits.sms` conditional `$inc`, a finalised
 * `sabsms_credit_reservations` row, a debit `sabsms_credit_ledger` row)
 * so balances and audit stay coherent with the ledger. Fail-closed.
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

import { randomUUID } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';

import { hashPhone } from './guardrails';

// ─── Collection names ──────────────────────────────────────────────────────

export const SABSMS_AGENT_CONFIGS_COLLECTION = 'sabsms_agent_configs';
export const SABSMS_AGENT_TURNS_COLLECTION = 'sabsms_agent_turns';

// ─── Document shapes ───────────────────────────────────────────────────────

export type SabsmsAgentMode = 'suggest' | 'auto';

export interface SabsmsAgentConfig {
  workspaceId: string;
  enabled: boolean;
  mode: SabsmsAgentMode;
  persona: string;
  /** Pasted knowledge base — plain text, chunked at query time. */
  knowledge: string;
  allowedTools: string[];
  maxTurnsPerConversation: number;
  /** Optional segment ids that full-auto is restricted to. */
  autoSegments?: string[];
  handoffKeywords: string[];
  updatedAt: Date;
}

export const DEFAULT_HANDOFF_KEYWORDS = ['agent', 'human', 'representative'];
export const DEFAULT_ALLOWED_TOOLS = [
  'lookupContact',
  'searchKnowledge',
  'handoffToHuman',
  'createNote',
];

export function defaultAgentConfig(workspaceId: string): SabsmsAgentConfig {
  return {
    workspaceId,
    enabled: false,
    mode: 'suggest',
    persona: '',
    knowledge: '',
    allowedTools: [...DEFAULT_ALLOWED_TOOLS],
    maxTurnsPerConversation: 6,
    handoffKeywords: [...DEFAULT_HANDOFF_KEYWORDS],
    updatedAt: new Date(0),
  };
}

export type SabsmsAgentTurnOutcome =
  | 'replied'
  | 'suggested'
  | 'handoff'
  | 'guarded'
  | 'error';

export interface SabsmsAgentToolCall {
  tool: string;
  args: Record<string, unknown>;
  /** Truncated stringified result for the audit trail. */
  result: string;
}

export interface SabsmsAgentTurn {
  turnId: string;
  workspaceId: string;
  conversationId: string;
  inboundMessageId: string;
  promptTokens?: number;
  completionTokens?: number;
  toolCalls: SabsmsAgentToolCall[];
  replyMessageId?: string;
  mode: SabsmsAgentMode;
  outcome: SabsmsAgentTurnOutcome;
  /** Why the turn was guarded / errored (when applicable). */
  reason?: string;
  at: Date;
}

/** Minimal conversation projection the agent pipeline needs. */
export interface AgentConversation {
  id: string;
  workspaceId: string;
  contactId: string;
  status: string;
  channel?: string;
  aiFlags?: {
    possibleOptOut?: boolean;
    handoff?: boolean;
    /** Inbound messageId the guardrail consumed (agent must skip it). */
    guardedInboundId?: string;
  };
  aiSuggestion?: { body: string; at: Date; inboundMessageId: string };
}

export interface AgentThreadMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  category?: string;
  from?: string;
  to?: string;
  isNote?: boolean;
  createdAt?: Date;
}

export interface AgentContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
}

// ─── Store interface ───────────────────────────────────────────────────────

export interface AgentStore {
  getConfig(workspaceId: string): Promise<SabsmsAgentConfig>;
  getConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<AgentConversation | null>;
  /** Flat dotted-path $set patch on the conversation doc. */
  patchConversation(
    workspaceId: string,
    conversationId: string,
    set: Record<string, unknown>,
    unset?: string[],
  ): Promise<void>;
  /** Last `limit` thread messages, oldest→newest, notes excluded. */
  listThreadMessages(
    workspaceId: string,
    conversationId: string,
    limit: number,
  ): Promise<AgentThreadMessage[]>;
  /** Single message by id (the inbound doc carries our reply-from number). */
  getMessage(
    workspaceId: string,
    messageId: string,
  ): Promise<AgentThreadMessage | null>;
  /** Stamp `conversationId` onto an engine-written outbound doc. */
  stampMessageConversation(
    workspaceId: string,
    messageId: string,
    conversationId: string,
  ): Promise<void>;
  /** Most recent OUTBOUND message in the conversation (category check). */
  lastOutbound(
    workspaceId: string,
    conversationId: string,
  ): Promise<AgentThreadMessage | null>;
  isSuppressed(workspaceId: string, phone: string): Promise<boolean>;
  /** Idempotent suppression upsert keyed (workspaceId, phoneHash). */
  upsertSuppression(params: {
    workspaceId: string;
    phone: string;
    source: string;
    reason: string;
  }): Promise<void>;
  insertConsentEvent(doc: {
    workspaceId: string;
    phoneHash: string;
    kind: string;
    captureMethod: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  insertNote(
    conversation: AgentConversation,
    body: string,
  ): Promise<void>;
  countTurns(workspaceId: string, conversationId: string): Promise<number>;
  /** Replay tolerance: has this inbound message already been processed? */
  hasTurnForInbound(
    workspaceId: string,
    inboundMessageId: string,
  ): Promise<boolean>;
  insertTurn(turn: SabsmsAgentTurn): Promise<void>;
  findContactByPhone(
    workspaceId: string,
    phone: string,
  ): Promise<AgentContact | null>;
  /**
   * Charge 1 credit for an auto agent turn — atomic, fail-closed.
   * Synthetic messageId `agent:{turnId}` in the ledger rows.
   */
  chargeAgentTurnCredit(
    workspaceId: string,
    turnId: string,
  ): Promise<{ approved: boolean; reason?: string }>;
}

// ─── Mongo implementation ──────────────────────────────────────────────────

let indexesEnsured = new WeakSet<Db>();

export async function ensureAgentIndexes(db: Db): Promise<void> {
  if (indexesEnsured.has(db)) return;
  indexesEnsured.add(db);
  try {
    await db
      .collection(SABSMS_AGENT_CONFIGS_COLLECTION)
      .createIndex({ workspaceId: 1 }, { unique: true });
    await db
      .collection(SABSMS_AGENT_TURNS_COLLECTION)
      .createIndex({ workspaceId: 1, conversationId: 1, at: -1 });
    await db
      .collection(SABSMS_AGENT_TURNS_COLLECTION)
      .createIndex({ workspaceId: 1, inboundMessageId: 1 });
  } catch {
    indexesEnsured = new WeakSet<Db>();
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function createMongoAgentStore(db: Db): AgentStore {
  const configs = db.collection(SABSMS_AGENT_CONFIGS_COLLECTION);
  const turns = db.collection(SABSMS_AGENT_TURNS_COLLECTION);
  const conversations = db.collection('sabsms_conversations');
  const messages = db.collection('sabsms_messages');
  const suppressions = db.collection('sabsms_suppressions');
  const consentLog = db.collection('sabsms_consent_log');
  const contacts = db.collection('contacts');

  function projectConversation(doc: Record<string, unknown>): AgentConversation {
    const aiSuggestion = doc.aiSuggestion as
      | { body?: string; at?: Date; inboundMessageId?: string }
      | undefined;
    return {
      id: String(doc._id),
      workspaceId: str(doc.workspaceId),
      contactId: str(doc.contactId),
      status: str(doc.status),
      channel: str(doc.channel) || undefined,
      aiFlags: (doc.aiFlags as AgentConversation['aiFlags']) ?? undefined,
      aiSuggestion:
        aiSuggestion && typeof aiSuggestion.body === 'string'
          ? {
              body: aiSuggestion.body,
              at: aiSuggestion.at instanceof Date ? aiSuggestion.at : new Date(0),
              inboundMessageId: str(aiSuggestion.inboundMessageId),
            }
          : undefined,
    };
  }

  function projectMessage(doc: Record<string, unknown>): AgentThreadMessage {
    return {
      id: String(doc._id),
      direction: doc.direction === 'inbound' ? 'inbound' : 'outbound',
      body: str(doc.body),
      category: str(doc.category) || undefined,
      from: str(doc.from) || undefined,
      to: str(doc.to) || undefined,
      isNote: Boolean(doc.isNote),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : undefined,
    };
  }

  return {
    async getConfig(workspaceId) {
      const doc = await configs.findOne({ workspaceId });
      if (!doc) return defaultAgentConfig(workspaceId);
      const fallback = defaultAgentConfig(workspaceId);
      return {
        workspaceId,
        enabled: Boolean(doc.enabled),
        mode: doc.mode === 'auto' ? 'auto' : 'suggest',
        persona: str(doc.persona),
        knowledge: str(doc.knowledge),
        allowedTools: Array.isArray(doc.allowedTools)
          ? doc.allowedTools.map(String)
          : fallback.allowedTools,
        maxTurnsPerConversation:
          typeof doc.maxTurnsPerConversation === 'number' &&
          doc.maxTurnsPerConversation > 0
            ? Math.floor(doc.maxTurnsPerConversation)
            : fallback.maxTurnsPerConversation,
        autoSegments: Array.isArray(doc.autoSegments)
          ? doc.autoSegments.map(String)
          : undefined,
        handoffKeywords:
          Array.isArray(doc.handoffKeywords) && doc.handoffKeywords.length > 0
            ? doc.handoffKeywords.map(String)
            : fallback.handoffKeywords,
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(0),
      };
    },

    async getConversation(workspaceId, conversationId) {
      if (!ObjectId.isValid(conversationId)) return null;
      const doc = await conversations.findOne({
        _id: new ObjectId(conversationId),
        workspaceId,
      });
      return doc ? projectConversation(doc as Record<string, unknown>) : null;
    },

    async patchConversation(workspaceId, conversationId, set, unset) {
      if (!ObjectId.isValid(conversationId)) return;
      const update: Record<string, unknown> = {
        $set: { ...set, updatedAt: new Date() },
      };
      if (unset && unset.length > 0) {
        update.$unset = Object.fromEntries(unset.map((k) => [k, '']));
      }
      await conversations.updateOne(
        { _id: new ObjectId(conversationId), workspaceId },
        update,
      );
    },

    async listThreadMessages(workspaceId, conversationId, limit) {
      const docs = await messages
        .find({
          workspaceId,
          conversationId,
          isNote: { $ne: true },
        })
        .sort({ createdAt: -1, _id: -1 })
        .limit(Math.max(1, limit))
        .toArray();
      return docs
        .reverse()
        .map((d) => projectMessage(d as Record<string, unknown>));
    },

    async getMessage(workspaceId, messageId) {
      if (!ObjectId.isValid(messageId)) return null;
      const doc = await messages.findOne({
        _id: new ObjectId(messageId),
        workspaceId,
      });
      return doc ? projectMessage(doc as Record<string, unknown>) : null;
    },

    async stampMessageConversation(workspaceId, messageId, conversationId) {
      if (!ObjectId.isValid(messageId)) return;
      await messages.updateOne(
        { _id: new ObjectId(messageId), workspaceId },
        { $set: { conversationId, updatedAt: new Date() } },
      );
    },

    async lastOutbound(workspaceId, conversationId) {
      const doc = await messages.findOne(
        {
          workspaceId,
          conversationId,
          direction: 'outbound',
          isNote: { $ne: true },
        },
        { sort: { createdAt: -1, _id: -1 } },
      );
      return doc ? projectMessage(doc as Record<string, unknown>) : null;
    },

    async isSuppressed(workspaceId, phone) {
      const doc = await suppressions.findOne({
        workspaceId,
        phoneHash: hashPhone(phone),
      });
      return Boolean(doc);
    },

    async upsertSuppression({ workspaceId, phone, source, reason }) {
      await suppressions.updateOne(
        { workspaceId, phoneHash: hashPhone(phone) },
        {
          $setOnInsert: {
            workspaceId,
            phoneHash: hashPhone(phone),
            source,
            reason,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    },

    async insertConsentEvent(doc) {
      await consentLog.insertOne({ ...doc, createdAt: new Date() });
    },

    async insertNote(conversation, body) {
      // Mirror of the inbox `addInternalNote` document shape.
      const now = new Date();
      await messages.insertOne({
        workspaceId: conversation.workspaceId,
        direction: 'outbound',
        channel: conversation.channel ?? 'sms',
        from: 'internal',
        to: conversation.contactId,
        body,
        category: 'service',
        status: 'sent',
        provider: 'twilio',
        conversationId: conversation.id,
        contactId: conversation.contactId,
        createdAt: now,
        updatedAt: now,
        isNote: true,
      });
    },

    async countTurns(workspaceId, conversationId) {
      return turns.countDocuments({
        workspaceId,
        conversationId,
        // Only turns that actually engaged count against maxTurns.
        outcome: { $in: ['replied', 'suggested'] },
      });
    },

    async hasTurnForInbound(workspaceId, inboundMessageId) {
      const doc = await turns.findOne({ workspaceId, inboundMessageId });
      return Boolean(doc);
    },

    async insertTurn(turn) {
      await turns.insertOne({ ...turn });
    },

    async findContactByPhone(workspaceId, phone) {
      const trimmed = phone.trim();
      const doc = await contacts.findOne({
        phone: trimmed,
        $or: [
          { workspaceId },
          ...(ObjectId.isValid(workspaceId)
            ? [{ projectId: new ObjectId(workspaceId) }, { userId: new ObjectId(workspaceId) }]
            : []),
        ],
      });
      if (!doc) return null;
      const d = doc as Record<string, unknown>;
      return {
        id: String(d._id),
        name: str(d.name) || undefined,
        email: str(d.email) || undefined,
        phone: str(d.phone) || undefined,
        tags: Array.isArray(d.tags) ? d.tags.map(String) : undefined,
      };
    },

    async chargeAgentTurnCredit(workspaceId, turnId) {
      if (!ObjectId.isValid(workspaceId)) {
        return { approved: false, reason: 'unknown_workspace' };
      }
      const users = db.collection('users');
      const reservations = db.collection('sabsms_credit_reservations');
      const ledger = db.collection('sabsms_credit_ledger');
      const amount = 1;
      const messageId = `agent:${turnId}`;

      // Replay tolerance: the same turnId never double-charges.
      const existing = await reservations.findOne({ messageId, workspaceId });
      if (existing) return { approved: true };

      // Atomic conditional debit — identical mechanics to
      // `reserveCredits` in credits/ledger.ts.
      const res = await users.updateOne(
        { _id: new ObjectId(workspaceId), 'credits.sms': { $gte: amount } },
        { $inc: { 'credits.sms': -amount } },
      );
      if (res.modifiedCount === 0) {
        return { approved: false, reason: 'insufficient_credits' };
      }

      const now = new Date();
      const token = randomUUID();
      // Reserve-and-finalise in one write: the LLM charge has no async
      // outcome to wait for, so the hold settles immediately.
      await reservations.insertOne({
        token,
        workspaceId,
        messageId,
        amount,
        status: 'finalised',
        createdAt: now,
        expiresAt: now,
        finalisedAt: now,
      });
      let balanceAfter: number | undefined;
      try {
        const user = await users.findOne(
          { _id: new ObjectId(workspaceId) },
          { projection: { 'credits.sms': 1 } },
        );
        const credits = (user as { credits?: { sms?: number } } | null)?.credits;
        balanceAfter = typeof credits?.sms === 'number' ? credits.sms : undefined;
      } catch {
        balanceAfter = undefined;
      }
      await ledger.insertOne({
        workspaceId,
        messageId,
        reservationToken: token,
        delta: -amount,
        kind: 'debit',
        balanceAfter,
        createdAt: now,
      });
      return { approved: true };
    },
  };
}

const mongoStoreCache = new WeakMap<Db, AgentStore>();

/** Cached per-Db store, mirroring the journeys `storeFor` pattern. */
export function agentStoreFor(db: Db): AgentStore {
  let store = mongoStoreCache.get(db);
  if (!store) {
    store = createMongoAgentStore(db);
    mongoStoreCache.set(db, store);
  }
  return store;
}

// ─── In-memory implementation (tests + eval harness) ───────────────────────

export interface MemoryAgentStoreSeed {
  config?: Partial<SabsmsAgentConfig> & { workspaceId: string };
  conversations?: AgentConversation[];
  messages?: Array<AgentThreadMessage & { workspaceId: string; conversationId: string }>;
  contacts?: Array<AgentContact & { workspaceId: string }>;
  /** Starting credit balance per workspaceId. */
  credits?: Record<string, number>;
  suppressedPhones?: Array<{ workspaceId: string; phone: string }>;
}

export interface MemoryAgentStore extends AgentStore {
  state: {
    configs: Map<string, SabsmsAgentConfig>;
    conversations: Map<string, AgentConversation>;
    messages: Array<AgentThreadMessage & { workspaceId: string; conversationId: string }>;
    suppressions: Array<{ workspaceId: string; phoneHash: string; source: string; reason: string }>;
    consentEvents: Array<Record<string, unknown>>;
    notes: Array<{ conversationId: string; body: string }>;
    turns: SabsmsAgentTurn[];
    contacts: Array<AgentContact & { workspaceId: string }>;
    credits: Map<string, number>;
    ledger: Array<Record<string, unknown>>;
  };
}

export function createMemoryAgentStore(
  seed: MemoryAgentStoreSeed = {},
): MemoryAgentStore {
  const state: MemoryAgentStore['state'] = {
    configs: new Map(),
    conversations: new Map(),
    messages: [...(seed.messages ?? [])],
    suppressions: [],
    consentEvents: [],
    notes: [],
    turns: [],
    contacts: [...(seed.contacts ?? [])],
    credits: new Map(Object.entries(seed.credits ?? {})),
    ledger: [],
  };
  if (seed.config) {
    state.configs.set(seed.config.workspaceId, {
      ...defaultAgentConfig(seed.config.workspaceId),
      ...seed.config,
    });
  }
  for (const c of seed.conversations ?? []) state.conversations.set(c.id, c);
  for (const s of seed.suppressedPhones ?? []) {
    state.suppressions.push({
      workspaceId: s.workspaceId,
      phoneHash: hashPhone(s.phone),
      source: 'seed',
      reason: 'seed',
    });
  }

  return {
    state,
    async getConfig(workspaceId) {
      return state.configs.get(workspaceId) ?? defaultAgentConfig(workspaceId);
    },
    async getConversation(workspaceId, conversationId) {
      const c = state.conversations.get(conversationId);
      return c && c.workspaceId === workspaceId ? c : null;
    },
    async patchConversation(workspaceId, conversationId, set, unset) {
      const c = state.conversations.get(conversationId);
      if (!c || c.workspaceId !== workspaceId) return;
      // Apply dotted paths shallowly enough for the agent's needs.
      const next: Record<string, unknown> = {
        ...(c as unknown as Record<string, unknown>),
      };
      for (const [path, value] of Object.entries(set)) {
        const parts = path.split('.');
        let target = next;
        for (let i = 0; i < parts.length - 1; i++) {
          const existingVal = target[parts[i]];
          const child =
            existingVal && typeof existingVal === 'object'
              ? { ...(existingVal as Record<string, unknown>) }
              : {};
          target[parts[i]] = child;
          target = child;
        }
        target[parts[parts.length - 1]] = value;
      }
      for (const path of unset ?? []) {
        const parts = path.split('.');
        let target: Record<string, unknown> | undefined = next;
        for (let i = 0; i < parts.length - 1 && target; i++) {
          target = target[parts[i]] as Record<string, unknown> | undefined;
        }
        if (target) delete target[parts[parts.length - 1]];
      }
      state.conversations.set(conversationId, next as unknown as AgentConversation);
    },
    async listThreadMessages(workspaceId, conversationId, limit) {
      return state.messages
        .filter(
          (m) =>
            m.workspaceId === workspaceId &&
            m.conversationId === conversationId &&
            !m.isNote,
        )
        .slice(-limit);
    },
    async getMessage(workspaceId, messageId) {
      return (
        state.messages.find(
          (m) => m.workspaceId === workspaceId && m.id === messageId,
        ) ?? null
      );
    },
    async stampMessageConversation(workspaceId, messageId, conversationId) {
      const m = state.messages.find(
        (msg) => msg.workspaceId === workspaceId && msg.id === messageId,
      );
      if (m) m.conversationId = conversationId;
    },
    async lastOutbound(workspaceId, conversationId) {
      const out = state.messages.filter(
        (m) =>
          m.workspaceId === workspaceId &&
          m.conversationId === conversationId &&
          m.direction === 'outbound' &&
          !m.isNote,
      );
      return out.length > 0 ? out[out.length - 1] : null;
    },
    async isSuppressed(workspaceId, phone) {
      const h = hashPhone(phone);
      return state.suppressions.some(
        (s) => s.workspaceId === workspaceId && s.phoneHash === h,
      );
    },
    async upsertSuppression({ workspaceId, phone, source, reason }) {
      const h = hashPhone(phone);
      if (
        !state.suppressions.some(
          (s) => s.workspaceId === workspaceId && s.phoneHash === h,
        )
      ) {
        state.suppressions.push({ workspaceId, phoneHash: h, source, reason });
      }
    },
    async insertConsentEvent(doc) {
      state.consentEvents.push({ ...doc, createdAt: new Date() });
    },
    async insertNote(conversation, body) {
      state.notes.push({ conversationId: conversation.id, body });
    },
    async countTurns(workspaceId, conversationId) {
      return state.turns.filter(
        (t) =>
          t.workspaceId === workspaceId &&
          t.conversationId === conversationId &&
          (t.outcome === 'replied' || t.outcome === 'suggested'),
      ).length;
    },
    async hasTurnForInbound(workspaceId, inboundMessageId) {
      return state.turns.some(
        (t) =>
          t.workspaceId === workspaceId &&
          t.inboundMessageId === inboundMessageId,
      );
    },
    async insertTurn(turn) {
      state.turns.push(turn);
    },
    async findContactByPhone(workspaceId, phone) {
      return (
        state.contacts.find(
          (c) => c.workspaceId === workspaceId && c.phone === phone.trim(),
        ) ?? null
      );
    },
    async chargeAgentTurnCredit(workspaceId, turnId) {
      const already = state.ledger.some(
        (row) => row.messageId === `agent:${turnId}`,
      );
      if (already) return { approved: true };
      const balance = state.credits.get(workspaceId) ?? 0;
      if (balance < 1) return { approved: false, reason: 'insufficient_credits' };
      state.credits.set(workspaceId, balance - 1);
      state.ledger.push({
        workspaceId,
        messageId: `agent:${turnId}`,
        delta: -1,
        kind: 'debit',
        createdAt: new Date(),
      });
      return { approved: true };
    },
  };
}
