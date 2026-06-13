/**
 * SabCRM — service-case SLA math + CSAT aggregation — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND the `'use client'` settings page can
 * import the types + the deterministic SLA / CSAT math directly. The Mongo /
 * provisioning side effects live in `./cases.server.ts`, which re-exports
 * everything here.
 *
 * ## Model
 *
 * A support CASE (object slug `cases`) carries a priority and a status. An SLA
 * {@link SlaPolicy} maps each priority to two time budgets — minutes to first
 * response and minutes to resolution. From a case's `createdAt`,
 * `firstResponseAt` and `resolvedAt` we derive two due timestamps and a single
 * roll-up {@link SlaStatus} (`'ok' | 'warning' | 'breached'`), persisted at
 * `data.slaStatus` so the generic record surface renders/filters/sorts it with
 * zero engine change (the AI-fields scalar envelope).
 *
 * CSAT is a 1–5 survey score captured on a public page; {@link aggregateCsat}
 * rolls a set of submissions into count / average / NPS-style buckets.
 *
 * Pure + deterministic: `now` is always passed in, never read from the clock.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** A case priority. Lowest → highest urgency. */
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Every recognised priority, in board / select order. */
export const CASE_PRIORITIES: readonly CasePriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
] as const;

/** A case lifecycle status. Open states accrue SLA; closed states stop it. */
export type CaseStatus = 'NEW' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';

/** Every recognised status, in board order. */
export const CASE_STATUSES: readonly CaseStatus[] = [
  'NEW',
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
] as const;

/** Statuses that mean the case is done — SLA clocks freeze here. */
export const CLOSED_STATUSES: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'RESOLVED',
  'CLOSED',
]);

/** One priority's SLA budget, in MINUTES. */
export interface SlaTarget {
  /** Minutes from open until a first response is due. */
  firstResponseMins: number;
  /** Minutes from open until resolution is due. */
  resolutionMins: number;
}

/** Per-priority SLA policy. A full map keyed by {@link CasePriority}. */
export type SlaPolicy = Record<CasePriority, SlaTarget>;

/** The rolled-up SLA health of a case. */
export type SlaStatus = 'ok' | 'warning' | 'breached';

/** The minimal case shape the SLA math needs (a slice of a record's `data`). */
export interface CaseLike {
  priority?: unknown;
  status?: unknown;
  /** ISO string or epoch ms — when the case was opened. */
  createdAt?: unknown;
  /** ISO string or epoch ms — when an agent first responded (optional). */
  firstResponseAt?: unknown;
  /** ISO string or epoch ms — when the case was resolved (optional). */
  resolvedAt?: unknown;
}

/** The computed SLA picture for a case — what {@link computeSla} returns. */
export interface SlaComputation {
  status: SlaStatus;
  /** Epoch ms a first response is due, or null when no createdAt. */
  firstResponseDue: number | null;
  /** Epoch ms resolution is due, or null when no createdAt. */
  resolutionDue: number | null;
  /** True once the case is resolved/closed (clocks frozen). */
  closed: boolean;
  /** True when the first-response clock has been satisfied or stopped. */
  firstResponseMet: boolean;
  /** True when the resolution clock has been satisfied or stopped. */
  resolutionMet: boolean;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

/** Sensible out-of-the-box SLA policy (minutes). Tighter as priority rises. */
export const DEFAULT_SLA_POLICY: SlaPolicy = {
  LOW: { firstResponseMins: 24 * 60, resolutionMins: 7 * 24 * 60 },
  MEDIUM: { firstResponseMins: 8 * 60, resolutionMins: 3 * 24 * 60 },
  HIGH: { firstResponseMins: 60, resolutionMins: 24 * 60 },
  URGENT: { firstResponseMins: 15, resolutionMins: 4 * 60 },
};

/**
 * Fraction of an SLA budget at which a still-open clock flips to `'warning'`.
 * 0.8 → the last 20% of the window is the warning zone.
 */
export const DEFAULT_WARNING_RATIO = 0.8;

/* -------------------------------------------------------------------------- */
/* Coercion helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Coerce an ISO string / epoch-ms / Date into epoch ms, or null. */
export function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    // All-digit strings are epoch ms; otherwise parse as a date string.
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/** Normalise an unknown into a {@link CasePriority}, defaulting to MEDIUM. */
export function normalizePriority(v: unknown): CasePriority {
  const s = String(v ?? '').toUpperCase();
  return (CASE_PRIORITIES as readonly string[]).includes(s)
    ? (s as CasePriority)
    : 'MEDIUM';
}

/** Normalise an unknown into a {@link CaseStatus}, defaulting to NEW. */
export function normalizeStatus(v: unknown): CaseStatus {
  const s = String(v ?? '').toUpperCase();
  return (CASE_STATUSES as readonly string[]).includes(s)
    ? (s as CaseStatus)
    : 'NEW';
}

/** True when a case's status means it's done (RESOLVED / CLOSED). */
export function isClosedStatus(v: unknown): boolean {
  return CLOSED_STATUSES.has(normalizeStatus(v));
}

/* -------------------------------------------------------------------------- */
/* SLA math                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The SLA budget for a priority, falling back to the {@link DEFAULT_SLA_POLICY}
 * entry when the supplied policy is partial / missing that priority.
 */
export function slaTarget(
  priority: unknown,
  policy?: Partial<SlaPolicy>,
): SlaTarget {
  const p = normalizePriority(priority);
  const fromPolicy = policy?.[p];
  const fallback = DEFAULT_SLA_POLICY[p];
  if (!fromPolicy) return fallback;
  const fr = Number(fromPolicy.firstResponseMins);
  const res = Number(fromPolicy.resolutionMins);
  return {
    firstResponseMins:
      Number.isFinite(fr) && fr > 0 ? fr : fallback.firstResponseMins,
    resolutionMins:
      Number.isFinite(res) && res > 0 ? res : fallback.resolutionMins,
  };
}

/** Epoch ms a first response is due for a case, or null when no open time. */
export function firstResponseDue(
  c: CaseLike,
  policy?: Partial<SlaPolicy>,
): number | null {
  const open = toMs(c.createdAt);
  if (open == null) return null;
  return open + slaTarget(c.priority, policy).firstResponseMins * 60_000;
}

/** Epoch ms resolution is due for a case, or null when no open time. */
export function resolutionDue(
  c: CaseLike,
  policy?: Partial<SlaPolicy>,
): number | null {
  const open = toMs(c.createdAt);
  if (open == null) return null;
  return open + slaTarget(c.priority, policy).resolutionMins * 60_000;
}

/**
 * Health of one due-clock at time `now`.
 *
 *  - If `metAt` is set (the milestone happened) → met on time vs. late.
 *  - Else compare `now` to `due` (and the warning threshold) for an open clock.
 */
function clockStatus(
  due: number | null,
  metAt: number | null,
  now: number,
  warningRatio: number,
  openedAt: number | null,
): { status: SlaStatus; met: boolean } {
  if (due == null) return { status: 'ok', met: true };
  if (metAt != null) {
    return { status: metAt <= due ? 'ok' : 'breached', met: true };
  }
  if (now > due) return { status: 'breached', met: false };
  // Warning when we've consumed >= warningRatio of the window.
  if (openedAt != null && due > openedAt) {
    const elapsed = now - openedAt;
    const window = due - openedAt;
    if (elapsed >= window * warningRatio) return { status: 'warning', met: false };
  }
  return { status: 'ok', met: false };
}

/** The worse of two SLA statuses (breached > warning > ok). */
export function worseStatus(a: SlaStatus, b: SlaStatus): SlaStatus {
  const rank: Record<SlaStatus, number> = { ok: 0, warning: 1, breached: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Compute the full SLA picture for a case at time `now` (epoch ms). Pure +
 * deterministic. A closed case freezes its clocks at `resolvedAt` (or, absent
 * that, treats both milestones as met so a closed case never shows breached
 * purely because nobody stamped a resolvedAt).
 */
export function computeSla(
  c: CaseLike,
  now: number,
  policy?: Partial<SlaPolicy>,
  warningRatio: number = DEFAULT_WARNING_RATIO,
): SlaComputation {
  const openedAt = toMs(c.createdAt);
  const frDue = firstResponseDue(c, policy);
  const resDue = resolutionDue(c, policy);
  const closed = isClosedStatus(c.status);
  const resolvedMs = toMs(c.resolvedAt);
  const firstRespMs = toMs(c.firstResponseAt);

  // First-response clock — satisfied by an explicit firstResponseAt, or by the
  // case having been resolved/closed (which implies it was responded to).
  const frMetAt = firstRespMs ?? (closed ? resolvedMs ?? now : null);
  const fr = clockStatus(frDue, frMetAt, now, warningRatio, openedAt);

  // Resolution clock — satisfied by resolvedAt, or "now" for a closed case
  // lacking an explicit resolvedAt (best-effort: don't punish missing stamps).
  const resMetAt = resolvedMs ?? (closed ? now : null);
  const res = clockStatus(resDue, resMetAt, now, warningRatio, openedAt);

  return {
    status: worseStatus(fr.status, res.status),
    firstResponseDue: frDue,
    resolutionDue: resDue,
    closed,
    firstResponseMet: fr.met,
    resolutionMet: res.met,
  };
}

/**
 * Convenience: just the roll-up {@link SlaStatus} for a case at `now`. Thin
 * wrapper over {@link computeSla} for callers that only want the badge value.
 */
export function slaStatus(
  c: CaseLike,
  now: number,
  policy?: Partial<SlaPolicy>,
  warningRatio: number = DEFAULT_WARNING_RATIO,
): SlaStatus {
  return computeSla(c, now, policy, warningRatio).status;
}

/* -------------------------------------------------------------------------- */
/* CSAT aggregation                                                            */
/* -------------------------------------------------------------------------- */

/** Clamp an unknown to an integer 1–5, or 0 when not a valid score. */
export function clampCsat(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/**
 * Coerce an unknown into a genuine 1–5 CSAT score, or null when the raw value
 * doesn't round into that range. Unlike {@link clampCsat} this does NOT bound —
 * an out-of-range survey value (e.g. 7) is rejected, not silently turned into a
 * 5, so {@link aggregateCsat} never counts bad submissions.
 */
export function asCsatScore(v: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? (r as 1 | 2 | 3 | 4 | 5) : null;
}

/** Aggregated CSAT for a set of submissions. */
export interface CsatAggregate {
  /** Number of scored submissions (score 1–5). */
  count: number;
  /** Mean score, 0 when no submissions. */
  average: number;
  /** % of responses that are 4 or 5 (the "satisfied" rate), 0–100. */
  satisfactionRate: number;
  /** Histogram of scores 1..5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * Roll a set of raw scores into a {@link CsatAggregate}. Ignores out-of-range
 * / non-numeric entries. Pure + deterministic.
 */
export function aggregateCsat(scores: readonly unknown[]): CsatAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let sum = 0;
  let count = 0;
  let satisfied = 0;
  for (const raw of scores) {
    const s = asCsatScore(raw);
    if (s === null) continue;
    distribution[s] += 1;
    sum += s;
    count += 1;
    if (s >= 4) satisfied += 1;
  }
  return {
    count,
    average: count ? Math.round((sum / count) * 100) / 100 : 0,
    satisfactionRate: count ? Math.round((satisfied / count) * 1000) / 10 : 0,
    distribution,
  };
}
