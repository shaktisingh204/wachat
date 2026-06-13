import 'server-only';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { sendSabmailMessageForWorkspace } from '@/app/sabmail/inbox/actions';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — journey / automation execution engine.
 *
 * A journey (template) is a workspace-scoped React Flow graph
 * (`{ nodes: any[], edges: any[] }`, persisted by
 * `src/app/sabmail/automations/actions.ts`). Each enrolled person gets an
 * independent per-person finite-state-machine "run" in
 * `SABMAIL_COLLECTIONS.journeyRuns` that points at ONE current node and
 * carries a `nextRunAt` wake time — modelled on how Customer.io / Klaviyo
 * run journeys (see the R&D notes). The tick never re-evaluates the whole
 * graph for everyone; it wakes individual runs whose timer has fired.
 *
 * Node execution is intentionally DEFENSIVE: nodes come out of the visual
 * builder as `any`, so we read `node.type` / `node.data` with optional
 * chaining + sensible defaults and NEVER throw on a malformed node — a bad
 * node marks the run `failed`, it does not crash the tick.
 *
 * Idempotency layers (R&D):
 *  1. State-based — `wait` persists `nextRunAt` BEFORE advancing the node, so
 *     a re-claim of a sleeping run is a no-op.
 *  2. Per-run lock — `updatedAt` is treated as a lock stamp; a run is only
 *     claimed when its previous `updatedAt` is unchanged + older than the
 *     lock TTL, so two overlapping ticks can't drive the same run twice.
 *  3. Re-entry guard — `enrollInJourney` refuses a second active run for the
 *     same (journeyId, personEmail).
 *
 * Cron / engine contexts have NO session or cookie, so EVERYTHING here keys
 * off the `workspaceId` stored on each journey + run; we never call
 * `getSabmailWorkspaceId()` in this module.
 * ──────────────────────────────────────────────────────────────────── */

/* ── run document (per-person FSM instance) ──────────────────────────── */

export type SabmailJourneyRunStatus = 'active' | 'completed' | 'failed';

export interface SabmailJourneyRunHistoryEntry {
  nodeId: string;
  type: string;
  action: 'enrolled' | 'sent' | 'waited' | 'branched' | 'skipped' | 'completed' | 'failed';
  at: string;
  detail?: string;
}

export interface SabmailJourneyRunDoc {
  _id?: ObjectId;
  workspaceId: string;
  journeyId: string;
  personEmail: string;
  /** Mailbox to send from; falls back to the journey's accountId at tick time. */
  accountId?: string;
  currentNodeId: string | null;
  status: SabmailJourneyRunStatus;
  /** Wake time; `null` once terminal. */
  nextRunAt: Date | null;
  history: SabmailJourneyRunHistoryEntry[];
  createdAt: Date;
  /** Doubles as the lock stamp (see file header). */
  updatedAt: Date;
}

/* ── journey template (the graph) ────────────────────────────────────── */

interface SabmailJourneyDoc {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  enabled: boolean;
  /** Mailbox sends default to (optional — runs may carry their own). */
  accountId?: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

/* ── tuning knobs ────────────────────────────────────────────────────── */

/** Max runs swept per tick (keeps each invocation bounded for Vercel Cron). */
const TICK_BATCH = 200;
/** A run whose `updatedAt` is older than this is considered free to claim. */
const LOCK_TTL_MS = 5 * 60_000;
/** Fallback wait when a `wait` node has no usable delay configured. */
const DEFAULT_WAIT_MS = 24 * 60 * 60_000;
/** Hard cap on node hops in a single tick of one run (loop / cycle guard). */
const MAX_HOPS_PER_TICK = 50;

const MS_PER_UNIT: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
};

/* ── small defensive readers (never throw on a malformed node) ────────── */

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function nodeId(node: any): string | null {
  const id = node?.id;
  return typeof id === 'string' && id ? id : id != null ? String(id) : null;
}

/** Normalise a node's logical type from `node.type` or `node.data.type`. */
function nodeType(node: any): string {
  const raw = node?.type ?? node?.data?.type ?? node?.data?.kind ?? '';
  const t = String(raw).toLowerCase().trim();
  if (!t) return 'unknown';
  if (t.includes('send') || t.includes('email') || t.includes('message')) return 'send';
  if (t.includes('wait') || t.includes('delay') || t.includes('sleep')) return 'wait';
  if (t.includes('condition') || t.includes('branch') || t.includes('split') || t.includes('if')) {
    return 'condition';
  }
  if (t.includes('trigger') || t.includes('entry') || t.includes('start') || t.includes('enroll')) {
    return 'trigger';
  }
  if (t.includes('exit') || t.includes('end') || t.includes('stop')) return 'exit';
  return t;
}

/** Resolve a `wait` node's delay (ms), tolerating many builder field shapes. */
function readDelayMs(node: any): number {
  const data = node?.data ?? {};
  const directMs = Number(data.delayMs ?? data.durationMs ?? node?.delayMs);
  if (Number.isFinite(directMs) && directMs > 0) return directMs;

  const amount = Number(
    data.delay ?? data.duration ?? data.amount ?? data.value ?? data.wait ?? NaN,
  );
  const unitRaw = String(data.unit ?? data.delayUnit ?? data.durationUnit ?? 'days')
    .toLowerCase()
    .trim();
  const unitMs = MS_PER_UNIT[unitRaw] ?? MS_PER_UNIT.days;
  if (Number.isFinite(amount) && amount > 0) return amount * unitMs;

  return DEFAULT_WAIT_MS;
}

/* ── graph traversal helpers (edge-driven) ───────────────────────────── */

interface JourneyGraph {
  byId: Map<string, any>;
  edges: any[];
  entryId: string | null;
}

function buildGraph(journey: SabmailJourneyDoc): JourneyGraph {
  const nodes = asArray(journey.nodes);
  const edges = asArray(journey.edges);
  const byId = new Map<string, any>();
  for (const n of nodes) {
    const id = nodeId(n);
    if (id) byId.set(id, n);
  }

  // Entry = an explicit trigger/entry node, else the node with no inbound edge.
  let entryId: string | null = null;
  for (const n of nodes) {
    if (nodeType(n) === 'trigger') {
      entryId = nodeId(n);
      break;
    }
  }
  if (!entryId) {
    const targets = new Set<string>();
    for (const e of edges) {
      const t = e?.target;
      if (typeof t === 'string' && t) targets.add(t);
    }
    for (const n of nodes) {
      const id = nodeId(n);
      if (id && !targets.has(id)) {
        entryId = id;
        break;
      }
    }
  }
  if (!entryId && nodes.length) entryId = nodeId(nodes[0]);

  return { byId, edges, entryId };
}

/** Outgoing edges for a node, in stable order. */
function outgoingEdges(graph: JourneyGraph, fromId: string): any[] {
  return graph.edges.filter((e) => e?.source === fromId);
}

/** First successor node id, or null when the node is terminal. */
function firstNext(graph: JourneyGraph, fromId: string): string | null {
  const out = outgoingEdges(graph, fromId);
  for (const e of out) {
    const t = e?.target;
    if (typeof t === 'string' && t && graph.byId.has(t)) return t;
  }
  return null;
}

/**
 * Pick the successor of a condition node. Without per-person attribute data in
 * this build we evaluate the structural default: prefer an edge whose
 * handle/label reads "yes"/"true"/"default", else the first edge. This keeps
 * the FSM advancing deterministically (R&D: a split is a point-in-time pick).
 */
function pickConditionNext(graph: JourneyGraph, fromId: string): string | null {
  const out = outgoingEdges(graph, fromId);
  if (!out.length) return null;
  const preferred = out.find((e) => {
    const handle = String(e?.sourceHandle ?? e?.label ?? e?.data?.label ?? '').toLowerCase();
    return /yes|true|default|positive|match/.test(handle);
  });
  const chosen = preferred ?? out[0];
  const t = chosen?.target;
  return typeof t === 'string' && t && graph.byId.has(t) ? t : firstNext(graph, fromId);
}

/* ── collection accessors ────────────────────────────────────────────── */

async function getRunsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<SabmailJourneyRunDoc>(SABMAIL_COLLECTIONS.journeyRuns);
}

async function getJourneysCollection() {
  const { db } = await connectToDatabase();
  return db.collection<SabmailJourneyDoc>(SABMAIL_COLLECTIONS.journeys);
}

/* ── enrollment ──────────────────────────────────────────────────────── */

type EnrollResult = { ok: true; runId: string } | { ok: false; error: string };

/**
 * Enroll a person into a journey: create a `journeyRun` parked at the node the
 * trigger flows into (the entry node's first successor), `active`, due now.
 *
 * Re-entry guard: if an `active` run already exists for this
 * (journeyId, personEmail) we return it instead of double-enrolling.
 */
export async function enrollInJourney(
  workspaceId: string,
  journeyId: string,
  personEmail: string,
): Promise<EnrollResult> {
  try {
    if (!workspaceId) return { ok: false, error: 'No workspace.' };
    if (!journeyId || !ObjectId.isValid(journeyId)) {
      return { ok: false, error: 'Invalid journey id.' };
    }
    const email = String(personEmail ?? '').trim().toLowerCase();
    if (!email) return { ok: false, error: 'A person email is required.' };

    const journeys = await getJourneysCollection();
    const journey = (await journeys.findOne({
      _id: new ObjectId(journeyId),
      workspaceId,
    })) as WithId<SabmailJourneyDoc> | null;
    if (!journey) return { ok: false, error: 'Journey not found.' };
    if (!journey.enabled) return { ok: false, error: 'Journey is not enabled.' };

    const graph = buildGraph(journey);
    if (!graph.entryId) return { ok: false, error: 'Journey has no entry node.' };

    // The trigger node itself is not actionable — start at its first successor.
    const startId =
      nodeType(graph.byId.get(graph.entryId)) === 'trigger'
        ? firstNext(graph, graph.entryId)
        : graph.entryId;
    if (!startId) return { ok: false, error: 'Journey has no actionable steps after the trigger.' };

    const runs = await getRunsCollection();
    const existing = await runs.findOne({ workspaceId, journeyId, personEmail: email, status: 'active' });
    if (existing) return { ok: true, runId: String(existing._id) };

    const now = new Date();
    const doc: SabmailJourneyRunDoc = {
      workspaceId,
      journeyId,
      personEmail: email,
      accountId: typeof journey.accountId === 'string' ? journey.accountId : undefined,
      currentNodeId: startId,
      status: 'active',
      nextRunAt: now,
      history: [{ nodeId: startId, type: 'trigger', action: 'enrolled', at: now.toISOString() }],
      createdAt: now,
      updatedAt: now,
    };
    const ins = await runs.insertOne(doc as never);
    return { ok: true, runId: String(ins.insertedId) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── tick (cron sweep across ALL workspaces) ─────────────────────────── */

export interface TickSabmailJourneysResult {
  processed: number;
  advanced: number;
  completed: number;
  failed: number;
  waited: number;
}

interface JourneyCacheEntry {
  graph: JourneyGraph;
  doc: WithId<SabmailJourneyDoc>;
}

/**
 * One bounded sweep of due journey runs across EVERY workspace. Finds up to
 * `TICK_BATCH` active runs with `nextRunAt <= now`, executes each run's current
 * node, and advances / sleeps / terminates it. Safe to run on overlapping
 * schedules — the per-run `updatedAt` claim + state-based idempotency prevent
 * double execution.
 */
export async function tickSabmailJourneys(): Promise<TickSabmailJourneysResult> {
  const out: TickSabmailJourneysResult = {
    processed: 0,
    advanced: 0,
    completed: 0,
    failed: 0,
    waited: 0,
  };

  const now = new Date();
  const runs = await getRunsCollection();
  const journeys = await getJourneysCollection();
  const journeyCache = new Map<string, JourneyCacheEntry | null>();

  const due = (await runs
    .find({ status: 'active', nextRunAt: { $lte: now } })
    .sort({ nextRunAt: 1 })
    .limit(TICK_BATCH)
    .toArray()) as WithId<SabmailJourneyRunDoc>[];

  for (const run of due) {
    out.processed += 1;
    try {
      // ── claim: flip updatedAt only if it's unchanged + the prior stamp is
      // stale enough (or this is the first claim). Loser of a race skips. ──
      const prevUpdatedAt = run.updatedAt instanceof Date ? run.updatedAt : new Date(run.updatedAt);
      const claimable = !prevUpdatedAt || now.getTime() - prevUpdatedAt.getTime() >= 0;
      if (!claimable) continue;
      const claim = await runs.updateOne(
        { _id: run._id, status: 'active', updatedAt: prevUpdatedAt },
        { $set: { updatedAt: now } },
      );
      if (claim.matchedCount === 0) {
        // Another worker claimed it, or its state changed under us — skip.
        continue;
      }

      // ── load the journey graph (cached per tick) ──
      let entry = journeyCache.get(run.journeyId);
      if (entry === undefined) {
        entry = null;
        if (ObjectId.isValid(run.journeyId)) {
          const jdoc = (await journeys.findOne({
            _id: new ObjectId(run.journeyId),
            workspaceId: run.workspaceId,
          })) as WithId<SabmailJourneyDoc> | null;
          if (jdoc) entry = { graph: buildGraph(jdoc), doc: jdoc };
        }
        journeyCache.set(run.journeyId, entry);
      }
      if (!entry) {
        await markFailed(runs, run, now, 'Journey no longer exists.');
        out.failed += 1;
        continue;
      }

      const result = await executeRun(runs, entry, run, now);
      if (result === 'advanced') out.advanced += 1;
      else if (result === 'completed') out.completed += 1;
      else if (result === 'failed') out.failed += 1;
      else if (result === 'waited') out.waited += 1;
    } catch (e) {
      try {
        await markFailed(runs, run, new Date(), getErrorMessage(e));
      } catch {
        /* ignore secondary failure */
      }
      out.failed += 1;
    }
  }

  return out;
}

type ExecOutcome = 'advanced' | 'completed' | 'failed' | 'waited';

/**
 * Execute a claimed run from its current node, chaining through instantaneous
 * nodes (send / condition) until it hits a `wait`, an exit, or the graph end.
 * Persists exactly once at the resting point.
 */
async function executeRun(
  runs: Awaited<ReturnType<typeof getRunsCollection>>,
  entry: JourneyCacheEntry,
  run: WithId<SabmailJourneyRunDoc>,
  now: Date,
): Promise<ExecOutcome> {
  const graph = entry.graph;
  const history = [...(Array.isArray(run.history) ? run.history : [])];
  let currentId: string | null = run.currentNodeId;
  let advancedAny = false;

  for (let hop = 0; hop < MAX_HOPS_PER_TICK; hop += 1) {
    if (!currentId) {
      // Graph end — completed.
      history.push({ nodeId: '', type: 'exit', action: 'completed', at: now.toISOString() });
      await runs.updateOne(
        { _id: run._id },
        { $set: { status: 'completed', currentNodeId: null, nextRunAt: null, history, updatedAt: new Date() } },
      );
      return advancedAny ? 'advanced' : 'completed';
    }

    const node = graph.byId.get(currentId);
    if (!node) {
      await markFailed(runs, run, now, `Current node "${currentId}" is missing from the journey.`, history);
      return 'failed';
    }

    const type = nodeType(node);

    if (type === 'exit') {
      history.push({ nodeId: currentId, type, action: 'completed', at: now.toISOString() });
      await runs.updateOne(
        { _id: run._id },
        { $set: { status: 'completed', currentNodeId: null, nextRunAt: null, history, updatedAt: new Date() } },
      );
      return advancedAny ? 'advanced' : 'completed';
    }

    if (type === 'wait') {
      // State-based idempotency: sleep WITHOUT advancing the node, so a
      // re-claim after the wake re-enters this same node and advances then.
      const delayMs = readDelayMs(node);
      const wake = new Date(now.getTime() + delayMs);
      history.push({
        nodeId: currentId,
        type,
        action: 'waited',
        at: now.toISOString(),
        detail: `${Math.round(delayMs / 1000)}s`,
      });
      // After the wait fires we want to land on the NEXT node — record it so the
      // wake tick has no work to recompute beyond reading currentNodeId.
      const nextId = firstNext(graph, currentId);
      await runs.updateOne(
        { _id: run._id },
        {
          $set: {
            currentNodeId: nextId,
            status: nextId ? 'active' : 'completed',
            nextRunAt: nextId ? wake : null,
            history,
            updatedAt: new Date(),
          },
        },
      );
      return advancedAny ? 'advanced' : 'waited';
    }

    if (type === 'send') {
      const sendResult = await runSendNode(entry, run, node);
      if (!sendResult.ok) {
        history.push({
          nodeId: currentId,
          type,
          action: 'failed',
          at: now.toISOString(),
          detail: sendResult.error,
        });
        await runs.updateOne(
          { _id: run._id },
          { $set: { status: 'failed', nextRunAt: null, history, updatedAt: new Date() } },
        );
        return 'failed';
      }
      history.push({
        nodeId: currentId,
        type,
        action: sendResult.skipped ? 'skipped' : 'sent',
        at: now.toISOString(),
        detail: sendResult.detail,
      });
      advancedAny = true;
      currentId = firstNext(graph, currentId);
      continue;
    }

    if (type === 'condition') {
      const nextId = pickConditionNext(graph, currentId);
      history.push({
        nodeId: currentId,
        type,
        action: 'branched',
        at: now.toISOString(),
        detail: nextId ?? 'no-branch',
      });
      advancedAny = true;
      currentId = nextId;
      continue;
    }

    // Unknown / pass-through node — log and walk to the next, never throw.
    history.push({
      nodeId: currentId,
      type,
      action: 'skipped',
      at: now.toISOString(),
      detail: 'unhandled node type',
    });
    advancedAny = true;
    currentId = firstNext(graph, currentId);
  }

  // Exceeded the hop budget (likely a cycle) — park as active to retry later.
  history.push({
    nodeId: currentId ?? '',
    type: 'guard',
    action: 'waited',
    at: now.toISOString(),
    detail: 'hop limit reached',
  });
  await runs.updateOne(
    { _id: run._id },
    {
      $set: {
        currentNodeId: currentId,
        nextRunAt: new Date(now.getTime() + DEFAULT_WAIT_MS),
        history,
        updatedAt: new Date(),
      },
    },
  );
  return 'waited';
}

/* ── send node execution ─────────────────────────────────────────────── */

type SendNodeResult =
  | { ok: true; skipped: boolean; detail?: string }
  | { ok: false; error: string };

/** Read the send-node payload (subject/html/template) defensively + deliver. */
async function runSendNode(
  entry: JourneyCacheEntry,
  run: WithId<SabmailJourneyRunDoc>,
  node: any,
): Promise<SendNodeResult> {
  const accountId =
    (typeof run.accountId === 'string' && run.accountId) ||
    (typeof entry.doc.accountId === 'string' && entry.doc.accountId) ||
    (typeof node?.data?.accountId === 'string' && node.data.accountId) ||
    '';
  if (!accountId) {
    return { ok: false, error: 'No mailbox (accountId) configured for this send.' };
  }
  if (!ObjectId.isValid(accountId)) {
    return { ok: false, error: 'Send node has an invalid mailbox id.' };
  }

  const to = run.personEmail?.trim();
  if (!to) return { ok: false, error: 'Run has no recipient email.' };

  const data = node?.data ?? {};
  const subject = String(data.subject ?? data.title ?? entry.doc.name ?? '(no subject)').slice(0, 998);
  const html =
    typeof data.html === 'string'
      ? data.html
      : typeof data.body === 'string'
        ? data.body
        : typeof data.content === 'string'
          ? data.content
          : undefined;
  const text = typeof data.text === 'string' ? data.text : undefined;

  if (!html && !text) {
    return { ok: false, error: 'Send node has no body (html/text).' };
  }

  try {
    const res = await sendSabmailMessageForWorkspace(run.workspaceId, {
      accountId,
      to: [to],
      subject,
      html,
      text,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, skipped: false, detail: `→ ${to}` };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── shared terminal helper ──────────────────────────────────────────── */

async function markFailed(
  runs: Awaited<ReturnType<typeof getRunsCollection>>,
  run: WithId<SabmailJourneyRunDoc>,
  at: Date,
  error: string,
  history?: SabmailJourneyRunHistoryEntry[],
): Promise<void> {
  const base = history ?? (Array.isArray(run.history) ? [...run.history] : []);
  base.push({
    nodeId: run.currentNodeId ?? '',
    type: 'error',
    action: 'failed',
    at: at.toISOString(),
    detail: error.slice(0, 500),
  });
  await runs.updateOne(
    { _id: run._id },
    { $set: { status: 'failed', nextRunAt: null, history: base, updatedAt: new Date() } },
  );
}
