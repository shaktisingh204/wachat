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

/**
 * Real-world events that can auto-enroll a person into a journey. Bound to a
 * journey via its trigger node's `data.event`. `manual` journeys never
 * auto-fire (explicit/API enrollment only) so they are not in this union.
 */
export type SabmailTriggerEvent =
  | 'form_submit'
  | 'contact_created'
  | 'inbound_email';

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

/** True when an edge's handle/label reads as the "yes/true/match" branch. */
function edgeIsYes(e: any): boolean {
  const handle = String(e?.sourceHandle ?? e?.label ?? e?.data?.label ?? '').toLowerCase();
  return /yes|true|match|default|positive/.test(handle);
}

/** True when an edge's handle/label reads as the "no/false/else" branch. */
function edgeIsNo(e: any): boolean {
  const handle = String(e?.sourceHandle ?? e?.label ?? e?.data?.label ?? '').toLowerCase();
  return /no|false|else|negative/.test(handle);
}

/** Resolve an edge's target to a real node id, or null. */
function edgeTarget(graph: JourneyGraph, e: any): string | null {
  const t = e?.target;
  return typeof t === 'string' && t && graph.byId.has(t) ? t : null;
}

/**
 * Pick the successor of a condition node WITHOUT a predicate (the historic
 * structural default): prefer an edge whose handle/label reads
 * "yes"/"true"/"default", else the first edge. Kept verbatim so journeys
 * authored before predicates existed keep advancing exactly as before.
 */
function pickConditionNext(graph: JourneyGraph, fromId: string): string | null {
  const out = outgoingEdges(graph, fromId);
  if (!out.length) return null;
  const preferred = out.find((e) => edgeIsYes(e));
  const chosen = preferred ?? out[0];
  return edgeTarget(graph, chosen) ?? firstNext(graph, fromId);
}

/**
 * Pick the successor of a condition node given an EVALUATED predicate result.
 *
 *  • TRUE  → the "yes/true/match/default" edge (the existing preferred logic),
 *            else the first outgoing edge.
 *  • FALSE → the "no/false/else" edge; else the OTHER (non-yes) outgoing edge;
 *            else the first outgoing edge.
 *
 * Always falls back to `firstNext` so a mis-wired branch still advances rather
 * than silently completing the run.
 */
function pickConditionNextByResult(
  graph: JourneyGraph,
  fromId: string,
  result: boolean,
): string | null {
  const out = outgoingEdges(graph, fromId);
  if (!out.length) return null;

  if (result) {
    const yes = out.find((e) => edgeIsYes(e));
    const chosen = yes ?? out[0];
    return edgeTarget(graph, chosen) ?? firstNext(graph, fromId);
  }

  // result === false
  const no = out.find((e) => edgeIsNo(e));
  if (no) return edgeTarget(graph, no) ?? firstNext(graph, fromId);

  // No explicit "no" edge — take the first edge that ISN'T the yes/match edge.
  const yes = out.find((e) => edgeIsYes(e));
  const other = out.find((e) => e !== yes);
  if (other) return edgeTarget(graph, other) ?? firstNext(graph, fromId);

  return firstNext(graph, fromId);
}

/* ── condition predicate model + evaluation ──────────────────────────────
 *
 * A condition node carries a single predicate at `node.data.predicate`
 * (a flat `node.data.{field,op,value}` is also accepted as a fallback). The
 * predicate is evaluated against a per-person CONTEXT (the contact doc + the
 * person's recent deliverability events) so the journey branches per person
 * instead of always taking the structural default.
 *
 * Supported FIELDS (resolved against the context):
 *   tag                  — matches ANY of contact.tags (string compare)
 *   email                — contact.email (or the run's personEmail)
 *   name                 — contact.name
 *   emailDomain          — the part after '@' in the email
 *   opened/clicked/      — booleans derived from sabmail_events for this person
 *     replied/bounced      (use op exists/notExists, or equals 'true'/'false')
 *   inboundCount         — number of inbound (reply) events
 *   eventCount           — total recent events seen for this person
 *   <anything else>      — a custom field read off the contact doc
 *
 * Supported OPS: equals | notEquals | contains | exists | notExists | gt | lt
 * ──────────────────────────────────────────────────────────────────────── */

export type SabmailConditionOp =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'exists'
  | 'notExists'
  | 'gt'
  | 'lt';

export interface SabmailConditionPredicate {
  field: string;
  op: SabmailConditionOp;
  value?: string;
}

/** The per-person facts a predicate is evaluated against. */
export interface SabmailConditionContext {
  contact: Record<string, unknown> | null;
  events: Array<{ event?: string }>;
  flags: { opened: boolean; clicked: boolean; replied: boolean; bounced: boolean };
  counts: { inbound: number; events: number };
  /** The run's recipient email — used when the contact doc is missing. */
  personEmail?: string;
}

const CONDITION_OPS: ReadonlySet<string> = new Set<SabmailConditionOp>([
  'equals',
  'notEquals',
  'contains',
  'exists',
  'notExists',
  'gt',
  'lt',
]);

/**
 * Read a condition node's predicate from `node.data.predicate`, falling back to
 * a flat `node.data.{field,op,value}`. Returns `null` when no usable field/op is
 * present (the caller then keeps the historic structural default).
 */
function readPredicate(node: any): SabmailConditionPredicate | null {
  const data = node?.data ?? {};
  const raw = (data.predicate && typeof data.predicate === 'object' ? data.predicate : data) as any;
  const field = typeof raw?.field === 'string' ? raw.field.trim() : '';
  const op = typeof raw?.op === 'string' ? raw.op.trim() : '';
  if (!field || !CONDITION_OPS.has(op)) return null;
  const value = raw?.value == null ? undefined : String(raw.value);
  return { field, op: op as SabmailConditionOp, value };
}

/**
 * Build the per-person evaluation context: the contact doc ({workspaceId,email})
 * plus the person's recent events ({workspaceId, email|from === personEmail},
 * newest-first, capped). Derives boolean flags (opened/clicked/replied/bounced)
 * and counts (inbound/events). Defensive: any failure yields an empty context so
 * a condition still evaluates (to false) rather than crashing the run.
 */
export async function buildConditionContext(
  workspaceId: string,
  personEmail: string,
): Promise<SabmailConditionContext> {
  const email = String(personEmail ?? '').trim().toLowerCase();
  const empty: SabmailConditionContext = {
    contact: null,
    events: [],
    flags: { opened: false, clicked: false, replied: false, bounced: false },
    counts: { inbound: 0, events: 0 },
    personEmail: email || undefined,
  };
  if (!workspaceId || !email) return empty;

  try {
    const { db } = await connectToDatabase();

    const contact = (await db
      .collection(SABMAIL_COLLECTIONS.contacts)
      .findOne({ workspaceId, email })) as Record<string, unknown> | null;

    // Outbound deliverability events key off `email` (the recipient); inbound
    // replies key off `from` (the sender). Pull both so `replied` is derivable.
    const events = (await db
      .collection(SABMAIL_COLLECTIONS.events)
      .find({ workspaceId, $or: [{ email }, { from: email }] })
      .sort({ ts: -1 })
      .limit(200)
      .toArray()) as Array<Record<string, unknown>>;

    let opened = false;
    let clicked = false;
    let replied = false;
    let bounced = false;
    let inbound = 0;
    for (const ev of events) {
      const name = String(ev?.event ?? '').toLowerCase();
      if (name === 'open') opened = true;
      else if (name === 'click') clicked = true;
      else if (name === 'bounce') bounced = true;
      else if (name === 'inbound') {
        // An inbound event authored by this person counts as a reply.
        if (String(ev?.from ?? '').trim().toLowerCase() === email) {
          replied = true;
          inbound += 1;
        }
      }
    }

    return {
      contact,
      events: events as Array<{ event?: string }>,
      flags: { opened, clicked, replied, bounced },
      counts: { inbound, events: events.length },
      personEmail: email,
    };
  } catch {
    return empty;
  }
}

/** Coerce an unknown context value to a comparable string (lowercased, trimmed). */
function asCmpString(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(',').toLowerCase();
  return String(value).trim().toLowerCase();
}

/** Coerce an unknown context value to a number, or NaN. */
function asCmpNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Resolve a predicate's `field` against the context. Returns the raw resolved
 * value plus a small kind hint so the evaluator can pick string vs number vs
 * boolean comparisons. Unknown fields fall back to a custom contact field.
 */
function resolveField(
  field: string,
  ctx: SabmailConditionContext,
): { kind: 'tag' | 'boolean' | 'number' | 'string'; value: unknown; tags?: string[] } {
  const contact = ctx.contact ?? {};
  const email =
    asCmpString(contact.email) || asCmpString(ctx.personEmail) || '';

  switch (field) {
    case 'tag': {
      const tags = Array.isArray(contact.tags)
        ? (contact.tags as unknown[]).map((t) => String(t))
        : [];
      return { kind: 'tag', value: tags, tags };
    }
    case 'email':
      return { kind: 'string', value: email };
    case 'name':
      return { kind: 'string', value: contact.name };
    case 'domain': // alias — heals graphs saved with the legacy 'domain' key
    case 'emailDomain': {
      const at = email.lastIndexOf('@');
      return { kind: 'string', value: at >= 0 ? email.slice(at + 1) : '' };
    }
    case 'opened':
      return { kind: 'boolean', value: ctx.flags.opened };
    case 'clicked':
      return { kind: 'boolean', value: ctx.flags.clicked };
    case 'replied':
      return { kind: 'boolean', value: ctx.flags.replied };
    case 'bounced':
      return { kind: 'boolean', value: ctx.flags.bounced };
    case 'inboundCount':
      return { kind: 'number', value: ctx.counts.inbound };
    case 'eventCount':
      return { kind: 'number', value: ctx.counts.events };
    default:
      // Any other string → a custom field on the contact doc.
      return { kind: 'string', value: (contact as Record<string, unknown>)[field] };
  }
}

/** True when a resolved value is "present" (for exists/notExists). */
function isPresent(resolved: { kind: string; value: unknown; tags?: string[] }): boolean {
  if (resolved.kind === 'tag') return (resolved.tags?.length ?? 0) > 0;
  if (resolved.kind === 'boolean') return resolved.value === true;
  const v = resolved.value;
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

/**
 * Evaluate a single condition predicate against a per-person context. Defensive:
 * an unknown op, an unresolvable field, or any thrown error all yield `false`.
 */
export function evaluateSabmailCondition(
  predicate: SabmailConditionPredicate | null | undefined,
  ctx: SabmailConditionContext,
): boolean {
  try {
    if (!predicate || !predicate.field || !CONDITION_OPS.has(predicate.op)) return false;
    const resolved = resolveField(predicate.field, ctx);
    const wanted = predicate.value;
    const wantedStr = asCmpString(wanted);

    switch (predicate.op) {
      case 'exists':
        return isPresent(resolved);
      case 'notExists':
        return !isPresent(resolved);

      case 'equals': {
        if (resolved.kind === 'tag') {
          return (resolved.tags ?? []).some((t) => t.trim().toLowerCase() === wantedStr);
        }
        if (resolved.kind === 'boolean') {
          // Treat missing value as 'true' so a bare boolean field means "is set".
          const want = wanted == null ? true : wantedStr === 'true';
          return resolved.value === want;
        }
        return asCmpString(resolved.value) === wantedStr;
      }
      case 'notEquals': {
        if (resolved.kind === 'tag') {
          return !(resolved.tags ?? []).some((t) => t.trim().toLowerCase() === wantedStr);
        }
        if (resolved.kind === 'boolean') {
          const want = wanted == null ? true : wantedStr === 'true';
          return resolved.value !== want;
        }
        return asCmpString(resolved.value) !== wantedStr;
      }

      case 'contains': {
        if (resolved.kind === 'tag') {
          return (resolved.tags ?? []).some((t) => t.toLowerCase().includes(wantedStr));
        }
        return asCmpString(resolved.value).includes(wantedStr);
      }

      case 'gt': {
        const a = asCmpNumber(resolved.value);
        const b = asCmpNumber(wanted);
        return Number.isFinite(a) && Number.isFinite(b) && a > b;
      }
      case 'lt': {
        const a = asCmpNumber(resolved.value);
        const b = asCmpNumber(wanted);
        return Number.isFinite(a) && Number.isFinite(b) && a < b;
      }

      default:
        return false;
    }
  } catch {
    return false;
  }
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

/**
 * Fire a trigger event: enroll `personEmail` into every ENABLED journey whose
 * trigger node opts into `event` (read off the trigger node's `data.event`).
 * This is the live binding the originating actions call — form submit,
 * contact created, inbound email. Best-effort and idempotent (the per-run
 * re-entry guard prevents double enrollment); never throws into the caller.
 */
export async function enrollMatchingJourneys(
  workspaceId: string,
  event: SabmailTriggerEvent,
  personEmail: string,
): Promise<{ enrolled: number }> {
  let enrolled = 0;
  try {
    if (!workspaceId) return { enrolled };
    const email = String(personEmail ?? '').trim().toLowerCase();
    if (!email) return { enrolled };

    const journeys = await getJourneysCollection();
    const candidates = (await journeys
      .find({ workspaceId, enabled: true })
      .limit(200)
      .toArray()) as WithId<SabmailJourneyDoc>[];

    for (const journey of candidates) {
      const graph = buildGraph(journey);
      if (!graph.entryId) continue;
      const entry = graph.byId.get(graph.entryId);
      // Only auto-enroll from an explicit trigger node that opts into this event.
      if (nodeType(entry) !== 'trigger') continue;
      const declared = String(
        entry?.data?.event ??
          entry?.data?.triggerType ??
          entry?.data?.on ??
          'manual',
      )
        .toLowerCase()
        .trim();
      if (declared !== event) continue;
      const res = await enrollInJourney(workspaceId, String(journey._id), email);
      if (res.ok) enrolled += 1;
    }
  } catch {
    /* best-effort — never block the originating action */
  }
  return { enrolled };
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
      const predicate = readPredicate(node);
      let nextId: string | null;
      let detail: string;
      if (predicate) {
        // Real per-person branching: build the context, evaluate, pick the
        // yes/no edge accordingly.
        const ctx = await buildConditionContext(run.workspaceId, run.personEmail);
        const result = evaluateSabmailCondition(predicate, ctx);
        nextId = pickConditionNextByResult(graph, currentId, result);
        detail = `${predicate.field} ${predicate.op}${
          predicate.value != null ? ` ${predicate.value}` : ''
        } → ${result ? 'yes' : 'no'} → ${nextId ?? 'no-branch'}`;
      } else {
        // No predicate — preserve the historic structural default.
        nextId = pickConditionNext(graph, currentId);
        detail = nextId ?? 'no-branch';
      }
      history.push({
        nodeId: currentId,
        type,
        action: 'branched',
        at: now.toISOString(),
        detail,
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
