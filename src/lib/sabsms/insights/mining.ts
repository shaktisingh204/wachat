/**
 * SabSMS conversation insights — LLM map-reduce topic/intent mining
 * (V2.12).
 *
 * `mineConversations(db, workspaceId, since)` pulls every conversation
 * with activity in the window, chunks the threads into batches of 20,
 * runs an LLM "map" over each batch (topics + intent histogram), then
 * a pure "reduce" (label normalization + merge) and INSERTS one
 * `sabsms_conversation_insights` document per run — previous documents
 * are kept so the inbox card can show a trend arrow vs the prior
 * window.
 *
 * All thread text is PII-scrubbed (`scrubPii`) before it reaches the
 * gateway. The reduce step is pure and unit-tested without any LLM.
 *
 * Runner: `scripts/sabsms-insights-nightly.mjs` (PM2 cron-restart,
 * mirroring `scripts/sabsms-identity-nightly.mjs`).
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

import type { Db } from 'mongodb';

import { scrubPii } from '../agent/guardrails';
import {
  defaultSabsmsLlmClient,
  parseLlmJson,
  type SabsmsLlmClient,
} from '../agent/llm';

export const SABSMS_CONVERSATION_INSIGHTS_COLLECTION =
  'sabsms_conversation_insights';

/** Threads per LLM map call. */
export const INSIGHTS_BATCH_SIZE = 20;
/** Conversations per workspace per run (cost ceiling). */
export const INSIGHTS_MAX_CONVERSATIONS = 400;
/** Messages of context per thread. */
const THREAD_MESSAGE_LIMIT = 12;

// ─── Shapes ────────────────────────────────────────────────────────────────

export type TopicSentiment = 'positive' | 'neutral' | 'negative';

export interface TopicRow {
  label: string;
  count: number;
  sentiment: TopicSentiment;
}

export interface ConversationInsightsDoc {
  workspaceId: string;
  window: '7d';
  topics: TopicRow[];
  intents: Record<string, number>;
  totalConversations: number;
  computedAt: Date;
  since: Date;
}

// ─── Pure reduce helpers (unit-tested) ─────────────────────────────────────

/**
 * Normalize a topic label so near-duplicates merge: lowercase, trim,
 * collapse whitespace, strip punctuation, drop leading articles and a
 * trailing plural "s" on the last word ("Shipping delays" ≡
 * "shipping delay").
 */
export function normalizeTopicLabel(label: string): string {
  let t = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^(the|a|an)\s+/, '');
  const words = t.split(' ');
  if (words.length > 0) {
    const last = words[words.length - 1];
    if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss')) {
      words[words.length - 1] = last.slice(0, -1);
    }
  }
  return words.join(' ');
}

function dominantSentiment(
  rows: Array<{ sentiment: TopicSentiment; count: number }>,
): TopicSentiment {
  const weights: Record<TopicSentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  for (const r of rows) weights[r.sentiment] += r.count;
  return (Object.entries(weights) as Array<[TopicSentiment, number]>).reduce(
    (best, cur) => (cur[1] > best[1] ? cur : best),
  )[0];
}

/** Merge per-batch topic lists into one normalized, count-sorted list. */
export function mergeTopicBatches(batches: TopicRow[][]): TopicRow[] {
  const byKey = new Map<
    string,
    { label: string; count: number; parts: Array<{ sentiment: TopicSentiment; count: number }> }
  >();
  for (const batch of batches) {
    for (const row of batch) {
      const label = String(row.label ?? '').trim();
      if (!label) continue;
      const count = Math.max(0, Math.floor(Number(row.count) || 0));
      if (count === 0) continue;
      const key = normalizeTopicLabel(label);
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += count;
        existing.parts.push({ sentiment: row.sentiment, count });
        // Keep the shortest human label as the display label.
        if (label.length < existing.label.length) existing.label = label;
      } else {
        byKey.set(key, {
          label,
          count,
          parts: [{ sentiment: row.sentiment, count }],
        });
      }
    }
  }
  return [...byKey.values()]
    .map((t) => ({
      label: t.label,
      count: t.count,
      sentiment: dominantSentiment(t.parts),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Merge per-batch intent histograms (lowercased keys, summed). */
export function mergeIntentBatches(
  batches: Array<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const batch of batches) {
    for (const [key, value] of Object.entries(batch ?? {})) {
      const k = key.toLowerCase().trim();
      const n = Math.max(0, Math.floor(Number(value) || 0));
      if (!k || n === 0) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

// ─── LLM map ───────────────────────────────────────────────────────────────

const MINING_SYSTEM = `You analyze batches of SMS conversation threads between businesses and customers.
Answer ONLY with a JSON object:
{"topics":[{"label":"<2-4 word topic>","count":<threads touching it>,"sentiment":"positive"|"neutral"|"negative"}],
 "intents":{"<intent>":<count>}}

Intent keys must come from: question, complaint, purchase, opt_out_request, scheduling, feedback, support, other.
Keep topic labels short and generic (e.g. "shipping delay", "pricing question"). At most 8 topics per batch.
PII has been masked with «PII_…» placeholders — ignore them.`;

interface BatchMap {
  topics: TopicRow[];
  intents: Record<string, number>;
}

function parseBatchMap(text: string): BatchMap | null {
  const parsed = parseLlmJson(text);
  if (!parsed) return null;
  const topicsRaw = Array.isArray(parsed.topics) ? parsed.topics : [];
  const topics: TopicRow[] = [];
  for (const t of topicsRaw) {
    if (!t || typeof t !== 'object') continue;
    const row = t as Record<string, unknown>;
    const label = typeof row.label === 'string' ? row.label : '';
    const count = Number(row.count);
    const sentiment =
      row.sentiment === 'positive' || row.sentiment === 'negative'
        ? row.sentiment
        : 'neutral';
    if (label && Number.isFinite(count) && count > 0) {
      topics.push({ label, count: Math.floor(count), sentiment });
    }
  }
  const intents: Record<string, number> = {};
  if (parsed.intents && typeof parsed.intents === 'object') {
    for (const [k, v] of Object.entries(parsed.intents as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) intents[k] = Math.floor(n);
    }
  }
  return { topics, intents };
}

// ─── Entry point ───────────────────────────────────────────────────────────

export interface MineDeps {
  llm?: SabsmsLlmClient;
  log?: (message: string, extra?: Record<string, unknown>) => void;
  batchSize?: number;
  maxConversations?: number;
}

export async function ensureInsightsIndexes(db: Db): Promise<void> {
  await db
    .collection(SABSMS_CONVERSATION_INSIGHTS_COLLECTION)
    .createIndex({ workspaceId: 1, window: 1, computedAt: -1 });
}

/**
 * Mine one workspace's conversations since `since` and INSERT a fresh
 * insights document (history is retained for trend computation).
 * Returns the inserted doc, or null when the window had no activity.
 */
export async function mineConversations(
  db: Db,
  workspaceId: string,
  since: Date,
  deps: MineDeps = {},
): Promise<ConversationInsightsDoc | null> {
  const llm = deps.llm ?? defaultSabsmsLlmClient;
  const log = deps.log ?? (() => undefined);
  const batchSize = deps.batchSize ?? INSIGHTS_BATCH_SIZE;
  const maxConversations = deps.maxConversations ?? INSIGHTS_MAX_CONVERSATIONS;

  const conversations = await db
    .collection('sabsms_conversations')
    .find({ workspaceId, lastMessageAt: { $gte: since } })
    .sort({ lastMessageAt: -1 })
    .limit(maxConversations)
    .toArray();
  if (conversations.length === 0) return null;

  // Render each thread to PII-scrubbed text.
  const threads: string[] = [];
  for (const conv of conversations) {
    const msgs = await db
      .collection('sabsms_messages')
      .find({
        workspaceId,
        conversationId: String(conv._id),
        isNote: { $ne: true },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(THREAD_MESSAGE_LIMIT)
      .toArray();
    if (msgs.length === 0) continue;
    const lines = msgs
      .reverse()
      .map((m) => {
        const who = m.direction === 'inbound' ? 'Customer' : 'Business';
        return `${who}: ${scrubPii(String(m.body ?? '')).text.slice(0, 280)}`;
      })
      .join('\n');
    threads.push(lines);
  }
  if (threads.length === 0) return null;

  // Map: one LLM call per batch of threads.
  const topicBatches: TopicRow[][] = [];
  const intentBatches: Array<Record<string, number>> = [];
  for (let i = 0; i < threads.length; i += batchSize) {
    const batch = threads.slice(i, i + batchSize);
    const prompt = batch
      .map((t, idx) => `--- Thread ${idx + 1} ---\n${t}`)
      .join('\n\n');
    const res = await llm({
      system: MINING_SYSTEM,
      prompt: prompt.slice(0, 24_000),
      maxTokens: 700,
    });
    if (!res.ok) {
      log('insights: batch map failed', { workspaceId, error: res.error });
      continue;
    }
    const mapped = parseBatchMap(res.text);
    if (!mapped) {
      log('insights: batch map unparseable', { workspaceId });
      continue;
    }
    topicBatches.push(mapped.topics);
    intentBatches.push(mapped.intents);
  }
  if (topicBatches.length === 0 && intentBatches.length === 0) return null;

  // Reduce (pure) + insert.
  const doc: ConversationInsightsDoc = {
    workspaceId,
    window: '7d',
    topics: mergeTopicBatches(topicBatches).slice(0, 25),
    intents: mergeIntentBatches(intentBatches),
    totalConversations: threads.length,
    computedAt: new Date(),
    since,
  };
  await ensureInsightsIndexes(db);
  await db
    .collection(SABSMS_CONVERSATION_INSIGHTS_COLLECTION)
    .insertOne({ ...doc });
  log('insights: workspace mined', {
    workspaceId,
    conversations: threads.length,
    topics: doc.topics.length,
  });
  return doc;
}

/**
 * Latest two insight docs for a workspace — the card computes per-topic
 * trend arrows from `current` vs `previous`.
 */
export async function loadInsightsWithTrend(
  db: Db,
  workspaceId: string,
): Promise<{
  current: ConversationInsightsDoc | null;
  previous: ConversationInsightsDoc | null;
}> {
  const docs = await db
    .collection(SABSMS_CONVERSATION_INSIGHTS_COLLECTION)
    .find({ workspaceId, window: '7d' })
    .sort({ computedAt: -1 })
    .limit(2)
    .toArray();
  return {
    current: (docs[0] as unknown as ConversationInsightsDoc) ?? null,
    previous: (docs[1] as unknown as ConversationInsightsDoc) ?? null,
  };
}

/** Trend of a topic vs the previous doc: up / down / flat / new. */
export function topicTrend(
  label: string,
  current: TopicRow[],
  previous: TopicRow[] | undefined,
): 'up' | 'down' | 'flat' | 'new' {
  const key = normalizeTopicLabel(label);
  const cur = current.find((t) => normalizeTopicLabel(t.label) === key);
  const prev = (previous ?? []).find((t) => normalizeTopicLabel(t.label) === key);
  if (!cur) return 'flat';
  if (!prev) return 'new';
  if (cur.count > prev.count) return 'up';
  if (cur.count < prev.count) return 'down';
  return 'flat';
}
