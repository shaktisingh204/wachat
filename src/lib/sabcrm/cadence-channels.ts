/**
 * SabCRM — multichannel cadence step model + dispatch math — PURE helpers.
 *
 * The structural twin of `./scoring.ts` / `./cadence-channels`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND the
 * `'use client'` cadence builder can import the types + the deterministic step
 * helpers directly. All Mongo / send side effects live in
 * `./cadence-channels.server.ts`, which re-exports everything here.
 *
 * ## Why this lives BESIDE the sequence engine, not inside it
 *
 * The existing cadence runtime is the Rust `sabcrm-sequences` crate (collections
 * `sabcrm_sequences` + `sabcrm_sequence_enrollments`) plus the TS auto-unenroll
 * hooks in `./sequences.server.ts`. That engine already walks an enrollment
 * through ordered steps and stamps `nextRunAt` / `history`. We do NOT rewrite
 * it. Instead this module adds a **channel layer**: a richer step shape (email /
 * sms / whatsapp / task / wait), a deterministic A/B subject split, and a "what
 * is the next step + when" helper, so the scheduler's existing advance path can
 * hand a step here and let `dispatchCadenceStep` (the `.server` sibling) route
 * it to SabMail / SabSMS / SabWa / the activities engine.
 *
 * ## Step model
 *
 * A {@link CadenceTemplate} targets one object (e.g. `leads`) and is an ordered
 * list of {@link CadenceStep}s. Each step carries a `delayHours` (the wait
 * BEFORE it relative to the previous step) and a `channel`:
 *
 *   - `email`    — subject + body, optional A/B `variants` (deterministic split)
 *   - `sms`      — body (the SMS text)
 *   - `whatsapp` — body (the WhatsApp session text)
 *   - `task`     — title + body, creates a TASK activity for a human to action
 *   - `wait`     — pure delay; dispatch is a no-op (the engine just waits)
 *
 * No I/O, no `crypto` import (the A/B hash is a tiny inline FNV-1a so the client
 * bundle stays clean and the split is reproducible across server + browser).
 */

/* -------------------------------------------------------------------------- */
/* Step model                                                                  */
/* -------------------------------------------------------------------------- */

/** The channel a cadence step fires on. */
export type CadenceChannel = 'email' | 'sms' | 'whatsapp' | 'task' | 'wait';

/** Every recognised channel (used to validate caller input). */
export const CADENCE_CHANNELS: readonly CadenceChannel[] = [
  'email',
  'sms',
  'whatsapp',
  'task',
  'wait',
] as const;

export function isCadenceChannel(value: unknown): value is CadenceChannel {
  return (
    typeof value === 'string' &&
    (CADENCE_CHANNELS as readonly string[]).includes(value)
  );
}

/**
 * One A/B subject variant for an EMAIL step. The split is deterministic per
 * (stepId, enrollmentId) so a record always gets the same variant across
 * retries / re-renders.
 */
export interface CadenceAbVariant {
  /** Stable id (React key + the chosen-variant history line). */
  id: string;
  /** Subject line for this arm. */
  subject: string;
  /** Relative weight (>= 0). Defaults to 1 when absent / non-finite. */
  weight?: number;
}

/** One ordered step in a cadence template. */
export interface CadenceStep {
  /** Stable id (React key + per-step idempotency + A/B hashing). */
  id: string;
  /** The channel this step fires on. */
  channel: CadenceChannel;
  /** Hours to WAIT before this step (relative to the previous step's run). */
  delayHours: number;
  /** EMAIL: subject line. Ignored when `variants` is non-empty. */
  subject?: string;
  /**
   * Message body. EMAIL/SMS/WHATSAPP: the content; TASK: the task note.
   * Supports `{{field}}` mustache tokens resolved at dispatch time.
   */
  body?: string;
  /** TASK: the task title. */
  title?: string;
  /** EMAIL: A/B subject arms. When 2+, `pickAbVariant` chooses one. */
  variants?: CadenceAbVariant[];
}

/** A persisted multichannel cadence template (doc shape minus the Mongo `_id`). */
export interface CadenceTemplate {
  id: string;
  projectId: string;
  /** The object slug this cadence is built for, e.g. `leads`. */
  objectSlug: string;
  name: string;
  enabled: boolean;
  steps: CadenceStep[];
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface CadenceTemplateInput {
  /** Present → update; absent → insert. */
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  steps: CadenceStep[];
}

/* -------------------------------------------------------------------------- */
/* Deterministic A/B split                                                     */
/* -------------------------------------------------------------------------- */

/**
 * FNV-1a 32-bit over a string → a uniformly-distributed unsigned int. Inlined
 * (no `crypto`) so the same split runs identically client + server and the
 * module stays import-free.
 */
export function hashToUnit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    // h *= 16777619 with 32-bit overflow via the Math.imul trick.
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 → unsigned; divide by 2^32 → [0, 1).
  return (h >>> 0) / 0x100000000;
}

/**
 * Pick ONE A/B variant deterministically from `(stepId, enrollmentId)`. The
 * choice is stable: the same enrollment + step always lands on the same arm,
 * so retries never re-roll the subject and the history line stays accurate.
 *
 * - `[]` / undefined → `null` (caller falls back to the step's plain `subject`)
 * - one variant → that variant
 * - many → weighted pick (weights default to 1; non-positive total → first)
 */
export function pickAbVariant(
  stepId: string,
  enrollmentId: string,
  variants: CadenceAbVariant[] | undefined,
): CadenceAbVariant | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  const weights = variants.map((v) =>
    Number.isFinite(v.weight) && (v.weight as number) > 0
      ? (v.weight as number)
      : 1,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return variants[0];

  // Deterministic point in [0, total) from the (step, enrollment) seed.
  const point = hashToUnit(`${stepId}::${enrollmentId}`) * total;
  let acc = 0;
  for (let i = 0; i < variants.length; i += 1) {
    acc += weights[i];
    if (point < acc) return variants[i];
  }
  return variants[variants.length - 1];
}

/**
 * The EMAIL subject to use for one dispatch: the chosen A/B arm's subject when
 * variants exist, else the step's plain `subject`. Returns the chosen variant
 * id (or `null`) so the caller can record WHICH arm fired for A/B reporting.
 */
export function resolveEmailSubject(
  step: CadenceStep,
  enrollmentId: string,
): { subject: string; variantId: string | null } {
  const chosen = pickAbVariant(step.id, enrollmentId, step.variants);
  if (chosen) return { subject: chosen.subject ?? '', variantId: chosen.id };
  return { subject: step.subject ?? '', variantId: null };
}

/* -------------------------------------------------------------------------- */
/* Step navigation                                                             */
/* -------------------------------------------------------------------------- */

/** What the scheduler should do after running step `idx`. */
export interface NextStepPlan {
  /** True when there are no more steps — the enrollment is complete. */
  done: boolean;
  /** Index of the next step to run (only meaningful when `!done`). */
  nextIndex: number;
  /** RFC3339 instant the next step should run at (only when `!done`). */
  nextRunAt: string | null;
}

/** Clamp a delay (hours) to a sane non-negative finite number. */
function safeDelayHours(step: CadenceStep | undefined): number {
  const h = step?.delayHours;
  if (!Number.isFinite(h) || (h as number) < 0) return 0;
  return h as number;
}

/**
 * Given the ordered `steps`, the index just RUN (`idx`) and the current instant
 * `now`, compute the next step + when it should run. The wait for a step is
 * that STEP's own `delayHours` (the delay sits BEFORE the step), so after
 * running step `idx` the engine schedules step `idx+1` at
 * `now + steps[idx+1].delayHours`.
 *
 * Returns `{ done: true }` once `idx` is the last step. Pure + deterministic.
 */
export function nextStepAfter(
  steps: CadenceStep[],
  idx: number,
  now: Date | string | number = new Date(),
): NextStepPlan {
  const list = Array.isArray(steps) ? steps : [];
  const nextIndex = idx + 1;
  if (nextIndex >= list.length) {
    return { done: true, nextIndex, nextRunAt: null };
  }
  const base = new Date(now);
  const ms = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  const delayMs = safeDelayHours(list[nextIndex]) * 3_600_000;
  return {
    done: false,
    nextIndex,
    nextRunAt: new Date(ms + delayMs).toISOString(),
  };
}

/**
 * RFC3339 instant the FIRST step of a cadence should run at (the first step's
 * own `delayHours` after enrolment `at`). Mirrors `nextStepAfter` semantics so
 * the very first step honours its configured delay.
 */
export function firstStepRunAt(
  steps: CadenceStep[],
  at: Date | string | number = new Date(),
): string {
  const list = Array.isArray(steps) ? steps : [];
  const base = new Date(at);
  const ms = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  const delayMs = safeDelayHours(list[0]) * 3_600_000;
  return new Date(ms + delayMs).toISOString();
}

/* -------------------------------------------------------------------------- */
/* Token rendering (shared by every channel)                                   */
/* -------------------------------------------------------------------------- */

/** Best-effort text view of a (possibly composite) value, for token fill. */
function asText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['label', 'name', 'title', 'value', 'primaryEmail', 'text']) {
      const c = o[k];
      if (typeof c === 'string' && c) return c;
      if (typeof c === 'number' || typeof c === 'boolean') return String(c);
    }
    return '';
  }
  return '';
}

/**
 * Replace `{{field}}` / `{{ field }}` mustache tokens with the record's
 * `data[field]` (best-effort text). Unknown tokens collapse to an empty string.
 * Pure — used for subject + body before a send.
 */
export function renderTokens(
  template: string,
  data: Record<string, unknown> | undefined,
): string {
  if (!template) return '';
  if (!data) return template.replace(/\{\{\s*[\w.]+\s*\}\}/g, '');
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) =>
    asText(data[key]),
  );
}

/* -------------------------------------------------------------------------- */
/* Validation / normalization (used by the save action + builder)              */
/* -------------------------------------------------------------------------- */

/**
 * Coerce a raw step into a clean {@link CadenceStep}: a valid channel, a
 * non-negative finite `delayHours`, trimmed strings and (for EMAIL) sane
 * variants (each needs an id + subject). Returns `null` for an unusable step
 * (e.g. an unknown channel) so the caller can drop it.
 */
export function normalizeStep(raw: unknown): CadenceStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isCadenceChannel(r.channel)) return null;

  const id =
    typeof r.id === 'string' && r.id.trim()
      ? r.id
      : `s_${Math.random().toString(36).slice(2, 12)}`;
  const delayHours =
    Number.isFinite(r.delayHours) && (r.delayHours as number) >= 0
      ? (r.delayHours as number)
      : 0;

  const step: CadenceStep = { id, channel: r.channel, delayHours };

  if (typeof r.subject === 'string') step.subject = r.subject.trim();
  if (typeof r.body === 'string') step.body = r.body.trim();
  if (typeof r.title === 'string') step.title = r.title.trim();

  if (Array.isArray(r.variants)) {
    const variants: CadenceAbVariant[] = [];
    for (const v of r.variants) {
      if (!v || typeof v !== 'object') continue;
      const vr = v as Record<string, unknown>;
      const subject = typeof vr.subject === 'string' ? vr.subject.trim() : '';
      if (!subject) continue;
      variants.push({
        id:
          typeof vr.id === 'string' && vr.id.trim()
            ? vr.id
            : `v_${Math.random().toString(36).slice(2, 10)}`,
        subject,
        weight:
          Number.isFinite(vr.weight) && (vr.weight as number) > 0
            ? (vr.weight as number)
            : 1,
      });
    }
    if (variants.length > 0) step.variants = variants;
  }

  return step;
}

/** Normalize + drop unusable steps from an ordered list. */
export function normalizeSteps(raw: unknown): CadenceStep[] {
  if (!Array.isArray(raw)) return [];
  const out: CadenceStep[] = [];
  for (const s of raw) {
    const norm = normalizeStep(s);
    if (norm) out.push(norm);
  }
  return out;
}

/**
 * A short, human label for a step's outcome history line. Pure so both the
 * dispatcher and any UI can render a consistent verb.
 */
export function channelOutcomeVerb(channel: CadenceChannel): string {
  switch (channel) {
    case 'email':
      return 'email_sent';
    case 'sms':
      return 'sms_sent';
    case 'whatsapp':
      return 'whatsapp_sent';
    case 'task':
      return 'task_created';
    case 'wait':
      return 'waited';
    default:
      return 'unknown';
  }
}
