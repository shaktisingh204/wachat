/**
 * SabCRM — Next-Best-Action (NBA) — PURE ranking helpers.
 *
 * The structural twin of `./scoring.ts` / `./ranking.ts`: a `'server-only'`-
 * and I/O-free module so the unit tests (`tsx --test`) AND the `'use client'`
 * NBA page can import the action types + the deterministic ranking math
 * directly. The Mongo assembly side lives in `./nba.server.ts`, which re-exports
 * everything here.
 *
 * ## Model
 *
 * A {@link NbaAction} is one suggested move a rep should make against a single
 * CRM record — "finish an overdue task", "follow up a hot lead", "rescue a
 * rotting deal", "reply to an unanswered inbound message", "send the due cadence
 * step". Every action carries:
 *   - a `kind` ({@link NbaActionKind}) that selects a base weight + the verb,
 *   - a `record` (object slug + id + display label) so the UI can deep-link to
 *     `/sabcrm/<object>/<recordId>`,
 *   - a set of {@link NbaSignals} (overdue-by-days, lead score, idle days, …)
 *     that {@link scoreAction} folds into a single 0–100 `urgency`,
 *   - a human `reason` string built from those signals.
 *
 * {@link scoreAction} is the pure scoring function — `urgency = clamp(base +
 * Σ signalContribution)`. {@link rankActions} sorts a candidate list by urgency
 * (desc), de-duplicates so one record never floods the queue with the same
 * action kind, and returns an ordered, urgency-tier-tagged work queue.
 *
 * No persistence here — the queue is recomputed on every read (a forecast-style
 * derived surface, not a stored entity), so there is NO storage envelope to
 * respect. The scalars it READS (`data.score`, `data.winProbability`, …) are the
 * AI/scoring envelope already written by `./scoring.server.ts` /
 * `./predictive-scoring.server.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Action kinds + base weights                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The five recognised next-best-action kinds. Ordered loosely by default
 * importance; the exact ordering is decided by {@link scoreAction}, not this
 * declaration order.
 */
export type NbaActionKind =
  /** A TASK activity that is past its due date and not DONE. */
  | 'overdue_task'
  /** A high-scoring / high-win-probability lead worth a touch now. */
  | 'hot_lead'
  /** An open deal that has gone idle in its stage past the rotting threshold. */
  | 'rotting_deal'
  /** An inbound message (email/call) the record has not had a reply to. */
  | 'unreplied_inbound'
  /** A cadence (sequence) step that is due to run for an enrolled record. */
  | 'due_cadence_step';

/** Every recognised NBA kind (validates assembled input). */
export const NBA_ACTION_KINDS: readonly NbaActionKind[] = [
  'overdue_task',
  'hot_lead',
  'rotting_deal',
  'unreplied_inbound',
  'due_cadence_step',
] as const;

/**
 * Base weight per kind (the urgency floor before per-action signals are added).
 * An unreplied inbound is the most time-sensitive (a customer is waiting); an
 * overdue task is a hard commitment; a rotting deal is at risk of loss; a due
 * cadence step keeps momentum; a hot lead is opportunity (high ceiling but no
 * hard deadline). Signals can lift any of these substantially.
 */
export const NBA_BASE_WEIGHT: Record<NbaActionKind, number> = {
  unreplied_inbound: 55,
  overdue_task: 50,
  rotting_deal: 40,
  due_cadence_step: 35,
  hot_lead: 30,
};

/** Human verb + a default reason fragment per kind (UI labels). */
export const NBA_KIND_LABEL: Record<NbaActionKind, string> = {
  overdue_task: 'Complete overdue task',
  hot_lead: 'Follow up hot lead',
  rotting_deal: 'Rescue rotting deal',
  unreplied_inbound: 'Reply to inbound message',
  due_cadence_step: 'Send due cadence step',
};

/** Lucide icon name per kind (rendered via the 20ui `renderIcon` helper). */
export const NBA_KIND_ICON: Record<NbaActionKind, string> = {
  overdue_task: 'CalendarClock',
  hot_lead: 'Flame',
  rotting_deal: 'AlertTriangle',
  unreplied_inbound: 'MailQuestion',
  due_cadence_step: 'Send',
};

/* -------------------------------------------------------------------------- */
/* Action + signal shapes                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The measurable inputs that lift an action's urgency above its base weight.
 * Every field is optional — only the ones relevant to the action's `kind` are
 * populated by the assembler, and {@link scoreAction} only reads the relevant
 * ones. All "days" values are whole, non-negative day counts.
 */
export interface NbaSignals {
  /** overdue_task: days the task is past due (0 when due today). */
  overdueDays?: number;
  /** overdue_task: task priority weight (HIGH/URGENT lift the action). */
  taskPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  /** hot_lead: the rule-based lead score (`data.score`). */
  leadScore?: number;
  /** hot_lead: predicted win probability 0–100 (`data.winProbability`). */
  winProbability?: number;
  /** hot_lead / rotting_deal: the deal amount (bigger deals matter more). */
  amount?: number;
  /** rotting_deal: days idle in the current stage past the rotting threshold. */
  idleDays?: number;
  /** rotting_deal: the configured rotting threshold for the stage (context). */
  rottingThresholdDays?: number;
  /** unreplied_inbound: hours the inbound message has waited for a reply. */
  waitingHours?: number;
  /** due_cadence_step: days the cadence step is overdue (0 when due today). */
  stepOverdueDays?: number;
  /** due_cadence_step: 1-based position of the step in the cadence. */
  stepNumber?: number;
}

/** Reference to the record an action targets (drives the deep-link). */
export interface NbaRecordRef {
  /** Object slug, e.g. `leads`. */
  object: string;
  /** Serialized record id. */
  recordId: string;
  /** Resolved display label for the card. */
  label: string;
}

/** One candidate next-best-action, before scoring/ranking. */
export interface NbaAction {
  /** Stable id (kind + record + a discriminator) for React keys + de-dupe. */
  id: string;
  kind: NbaActionKind;
  record: NbaRecordRef;
  signals: NbaSignals;
  /**
   * Optional ISO timestamp that anchors the action in time (task due date,
   * inbound received-at, cadence step due-at). Used only as a stable tiebreak.
   */
  dueAt?: string;
  /** Optional extra context the assembler wants to surface verbatim. */
  detail?: string;
}

/** Urgency banding for the UI (color + grouping). */
export type NbaUrgencyTier = 'critical' | 'high' | 'medium' | 'low';

/** A scored + reasoned action ready to render in the queue. */
export interface RankedNbaAction extends NbaAction {
  /** 0–100 urgency, the sort key. */
  urgency: number;
  /** Resolved urgency band. */
  tier: NbaUrgencyTier;
  /** Human-readable "why this is here". */
  reason: string;
  /** Human verb for the primary CTA. */
  label: string;
  /** Lucide icon name for the card. */
  icon: string;
}

/* -------------------------------------------------------------------------- */
/* Numeric helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Clamp `n` into `[lo, hi]`; non-finite → `lo`. */
function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Non-negative finite number, else 0. */
function nn(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Diminishing-returns curve: maps `days` to 0..cap, ~half-cap at `half` days. */
function saturate(days: number, half: number, cap: number): number {
  const d = nn(days);
  if (d <= 0) return 0;
  return clamp((cap * d) / (d + half), 0, cap);
}

/** Priority → urgency lift for tasks. */
const TASK_PRIORITY_LIFT: Record<NonNullable<NbaSignals['taskPriority']>, number> = {
  LOW: 0,
  MEDIUM: 4,
  HIGH: 10,
  URGENT: 16,
};

/* -------------------------------------------------------------------------- */
/* Scoring                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Per-kind urgency contribution from an action's signals (the part added on top
 * of the base weight). Each branch only reads the signals relevant to its kind,
 * with diminishing-returns curves so a single huge signal can't dominate.
 */
function signalContribution(action: NbaAction): number {
  const s = action.signals ?? {};
  switch (action.kind) {
    case 'overdue_task': {
      // Overdue grows fast then saturates (a task 30 days late is not 6× worse
      // than one 5 days late). Priority adds a flat lift.
      const overdue = saturate(s.overdueDays ?? 0, 7, 30);
      const priority = s.taskPriority ? TASK_PRIORITY_LIFT[s.taskPriority] : 0;
      return overdue + priority;
    }
    case 'hot_lead': {
      // Score (0–100) and win-probability (0–100) each contribute up to ~20,
      // amount adds a small ceiling so a big hot lead floats above a small one.
      const score = clamp(nn(s.leadScore) * 0.2, 0, 24);
      const win = clamp(nn(s.winProbability) * 0.18, 0, 20);
      const amount = clamp(Math.log10(nn(s.amount) + 1) * 4, 0, 16);
      return score + win + amount;
    }
    case 'rotting_deal': {
      // Idle days past the threshold dominate; amount lifts the ceiling.
      const idle = saturate(s.idleDays ?? 0, 10, 34);
      const amount = clamp(Math.log10(nn(s.amount) + 1) * 4, 0, 16);
      return idle + amount;
    }
    case 'unreplied_inbound': {
      // Waiting hours saturate quickly — even a few hours unanswered is urgent.
      return saturate(s.waitingHours ?? 0, 6, 35);
    }
    case 'due_cadence_step': {
      // Overdue steps grow; earlier steps (lower number) matter slightly more
      // because dropping the start of a cadence loses the whole sequence.
      const overdue = saturate(s.stepOverdueDays ?? 0, 5, 28);
      const earliness = s.stepNumber ? clamp(8 - (s.stepNumber - 1) * 2, 0, 8) : 0;
      return overdue + earliness;
    }
    default:
      return 0;
  }
}

/**
 * Score one action: `urgency = clamp(base + signalContribution, 0, 100)`. Pure
 * + deterministic (no clock reads — every time-relative signal is precomputed
 * by the assembler into the `signals` bag).
 */
export function scoreAction(action: NbaAction): number {
  const base = NBA_BASE_WEIGHT[action.kind] ?? 0;
  return Math.round(clamp(base + signalContribution(action), 0, 100));
}

/** Map an urgency score to a tier band. */
export function urgencyTier(urgency: number): NbaUrgencyTier {
  if (urgency >= 80) return 'critical';
  if (urgency >= 60) return 'high';
  if (urgency >= 40) return 'medium';
  return 'low';
}

/* -------------------------------------------------------------------------- */
/* Reason building                                                             */
/* -------------------------------------------------------------------------- */

/** Pluralize a unit by count ("1 day" / "3 days"). */
function plural(n: number, unit: string): string {
  const v = Math.round(n);
  return `${v} ${unit}${v === 1 ? '' : 's'}`;
}

/** Format a currency-ish amount compactly ("$12.5k"); '' when not positive. */
function fmtAmount(amount: number): string {
  const a = nn(amount);
  if (a <= 0) return '';
  if (a >= 1000) return `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(a)}`;
}

/**
 * Build the human "why" string for an action from its signals. Deterministic —
 * the assembler may override this by setting `detail`, which {@link rankActions}
 * appends.
 */
export function actionReason(action: NbaAction): string {
  const s = action.signals ?? {};
  switch (action.kind) {
    case 'overdue_task': {
      const days = Math.round(nn(s.overdueDays));
      const pr =
        s.taskPriority && s.taskPriority !== 'LOW'
          ? `, ${s.taskPriority.toLowerCase()} priority`
          : '';
      return days <= 0
        ? `Task due today${pr}`
        : `Task overdue by ${plural(days, 'day')}${pr}`;
    }
    case 'hot_lead': {
      const parts: string[] = [];
      if (nn(s.leadScore) > 0) parts.push(`score ${Math.round(nn(s.leadScore))}`);
      if (nn(s.winProbability) > 0) {
        parts.push(`${Math.round(nn(s.winProbability))}% win`);
      }
      const amt = fmtAmount(nn(s.amount));
      if (amt) parts.push(amt);
      return parts.length > 0
        ? `Hot lead — ${parts.join(', ')}`
        : 'Hot lead worth a touch';
    }
    case 'rotting_deal': {
      const idle = Math.round(nn(s.idleDays));
      const thr = nn(s.rottingThresholdDays);
      const amt = fmtAmount(nn(s.amount));
      const idlePart =
        idle > 0
          ? `idle ${plural(idle, 'day')} past the ${
              thr > 0 ? plural(thr, 'day') + ' ' : ''
            }rot threshold`
          : 'stalled in stage';
      return amt ? `${amt} deal ${idlePart}` : `Deal ${idlePart}`;
    }
    case 'unreplied_inbound': {
      const hrs = Math.round(nn(s.waitingHours));
      if (hrs <= 0) return 'Inbound message awaiting a reply';
      if (hrs < 24) return `Inbound waiting ${plural(hrs, 'hour')} for a reply`;
      return `Inbound waiting ${plural(hrs / 24, 'day')} for a reply`;
    }
    case 'due_cadence_step': {
      const step = nn(s.stepNumber);
      const od = Math.round(nn(s.stepOverdueDays));
      const stepPart = step > 0 ? `Cadence step ${Math.round(step)}` : 'Cadence step';
      return od <= 0
        ? `${stepPart} due now`
        : `${stepPart} overdue by ${plural(od, 'day')}`;
    }
    default:
      return NBA_KIND_LABEL[action.kind] ?? 'Suggested action';
  }
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                      */
/* -------------------------------------------------------------------------- */

/** Options controlling {@link rankActions}. */
export interface RankActionsOptions {
  /** Cap on the returned queue length (default 50). */
  limit?: number;
  /**
   * Max actions of the SAME kind per record, so one record can't flood the
   * queue with five overdue tasks (default 1 — keep the single most urgent).
   */
  maxPerRecordKind?: number;
}

/**
 * Score, de-duplicate and order a candidate list into a ranked work queue.
 *
 * Sort: urgency DESC, then the earlier `dueAt` first (more time-sensitive),
 * then a stable id compare so the order is fully deterministic. After sorting,
 * keep at most `maxPerRecordKind` actions per (record, kind) pair (the most
 * urgent survive because we cull AFTER sorting), then truncate to `limit`.
 *
 * Pure — no clock reads, no I/O.
 */
export function rankActions(
  actions: NbaAction[],
  options: RankActionsOptions = {},
): RankedNbaAction[] {
  const limit = clamp(options.limit ?? 50, 1, 500);
  const maxPerRecordKind = clamp(options.maxPerRecordKind ?? 1, 1, 50);

  const scored: RankedNbaAction[] = (actions ?? [])
    .filter(
      (a): a is NbaAction =>
        !!a &&
        (NBA_ACTION_KINDS as readonly string[]).includes(a.kind) &&
        !!a.record?.object &&
        !!a.record?.recordId,
    )
    .map((a) => {
      const urgency = scoreAction(a);
      const baseReason = actionReason(a);
      const reason = a.detail ? `${baseReason} · ${a.detail}` : baseReason;
      return {
        ...a,
        urgency,
        tier: urgencyTier(urgency),
        reason,
        label: NBA_KIND_LABEL[a.kind],
        icon: NBA_KIND_ICON[a.kind],
      };
    });

  scored.sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    // Earlier due first when equally urgent (time-sensitivity tiebreak).
    const ta = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const tb = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    const va = Number.isFinite(ta) ? ta : Number.POSITIVE_INFINITY;
    const vb = Number.isFinite(tb) ? tb : Number.POSITIVE_INFINITY;
    if (va !== vb) return va - vb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Cull duplicate (record, kind) beyond the cap — most urgent already first.
  const perKeyCount = new Map<string, number>();
  const culled: RankedNbaAction[] = [];
  for (const a of scored) {
    const key = `${a.record.object}:${a.record.recordId}:${a.kind}`;
    const seen = perKeyCount.get(key) ?? 0;
    if (seen >= maxPerRecordKind) continue;
    perKeyCount.set(key, seen + 1);
    culled.push(a);
    if (culled.length >= limit) break;
  }
  return culled;
}

/** Roll up a ranked queue into per-kind + per-tier counts (for header chips). */
export interface NbaQueueSummary {
  total: number;
  byKind: Record<NbaActionKind, number>;
  byTier: Record<NbaUrgencyTier, number>;
}

/** Build the {@link NbaQueueSummary} for a ranked queue. Pure. */
export function summarizeQueue(queue: RankedNbaAction[]): NbaQueueSummary {
  const byKind: Record<NbaActionKind, number> = {
    overdue_task: 0,
    hot_lead: 0,
    rotting_deal: 0,
    unreplied_inbound: 0,
    due_cadence_step: 0,
  };
  const byTier: Record<NbaUrgencyTier, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const a of queue ?? []) {
    byKind[a.kind] += 1;
    byTier[a.tier] += 1;
  }
  return { total: (queue ?? []).length, byKind, byTier };
}
