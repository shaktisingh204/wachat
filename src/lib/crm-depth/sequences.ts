/**
 * Email/SMS/WhatsApp drip sequences with branching.
 *
 * The runtime is intentionally pure: callers pass an enrolment record into
 * `nextStep` to discover what to do next without needing a queue. This makes
 * the engine trivial to reuse from server actions, cron workers, or tests.
 */
import type {
  Sequence,
  SequenceCondition,
  SequenceStep,
} from './types';

export interface SequenceEnrolment {
  id: string;
  sequenceId: string;
  contactId: string;
  /** Step id currently scheduled / executing. */
  currentStepId?: string;
  /** ISO timestamp the current step is due. */
  dueAt?: string;
  /** Step ids already executed (to prevent loops). */
  history: string[];
  status: 'active' | 'paused' | 'completed' | 'stopped';
  startedAt: string;
  completedAt?: string;
  /** Snapshot of facts (contact + deal data) used in conditions. */
  context?: Record<string, unknown>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function evaluateCondition(
  cond: SequenceCondition,
  context: Record<string, unknown>,
): boolean {
  const value = getPath(context, cond.field);
  switch (cond.op) {
    case 'eq': return value === cond.value;
    case 'neq': return value !== cond.value;
    case 'gt': return typeof value === 'number' && typeof cond.value === 'number' && value > cond.value;
    case 'gte': return typeof value === 'number' && typeof cond.value === 'number' && value >= cond.value;
    case 'lt': return typeof value === 'number' && typeof cond.value === 'number' && value < cond.value;
    case 'lte': return typeof value === 'number' && typeof cond.value === 'number' && value <= cond.value;
    case 'in': return Array.isArray(cond.value) && (cond.value as unknown[]).includes(value);
    case 'contains':
      if (Array.isArray(value)) return value.includes(cond.value);
      if (typeof value === 'string') return typeof cond.value === 'string' && value.includes(cond.value);
      return false;
    case 'exists': return value !== undefined && value !== null;
    default: return false;
  }
}

function findStep(seq: Sequence, stepId: string | undefined): SequenceStep | undefined {
  if (!stepId) return undefined;
  return seq.steps.find(s => s.id === stepId);
}

function firstStep(seq: Sequence): SequenceStep | undefined {
  if (seq.steps.length === 0) return undefined;
  return [...seq.steps].sort((a, b) => a.order - b.order)[0];
}

function nextOrderedStep(seq: Sequence, after: SequenceStep): SequenceStep | undefined {
  return [...seq.steps]
    .sort((a, b) => a.order - b.order)
    .find(s => s.order > after.order);
}

/**
 * Enrol a contact into a sequence — schedules the first step.
 */
export function enrol(
  sequence: Sequence,
  contactId: string,
  context: Record<string, unknown> = {},
): SequenceEnrolment {
  if (!sequence.active) {
    throw new Error(`sequence ${sequence.id} is inactive`);
  }
  const step = firstStep(sequence);
  const startedAt = nowIso();
  const dueAt = step
    ? new Date(Date.now() + (step.delayHours ?? 0) * 3_600_000).toISOString()
    : undefined;
  return {
    id: randomId('enrol'),
    sequenceId: sequence.id,
    contactId,
    currentStepId: step?.id,
    dueAt,
    history: [],
    status: step ? 'active' : 'completed',
    startedAt,
    context,
  };
}

export interface AdvanceResult {
  enrolment: SequenceEnrolment;
  /** The step that was just executed, if any. */
  executedStep?: SequenceStep;
  /** The next scheduled step, if any. */
  nextStep?: SequenceStep;
}

/**
 * Advance an enrolment past its current step. Evaluates branching conditions
 * to determine the next step. If no condition matches and no `onTrue/False`
 * branch is configured, the sequence advances by `order`.
 */
export function advance(
  sequence: Sequence,
  enrolment: SequenceEnrolment,
  facts?: Record<string, unknown>,
): AdvanceResult {
  if (enrolment.status !== 'active') {
    return { enrolment };
  }
  const current = findStep(sequence, enrolment.currentStepId);
  if (!current) {
    return {
      enrolment: { ...enrolment, status: 'completed', completedAt: nowIso() },
    };
  }

  const ctx = { ...(enrolment.context ?? {}), ...(facts ?? {}) };
  const history = [...enrolment.history, current.id];

  let nextId: string | undefined;
  if (current.condition) {
    const branch = evaluateCondition(current.condition, ctx);
    nextId = branch ? current.onTrueNextStepId : current.onFalseNextStepId;
  }
  if (!nextId) {
    const nxt = nextOrderedStep(sequence, current);
    nextId = nxt?.id;
  }

  // Guard against revisiting steps we've already executed.
  if (nextId && history.includes(nextId)) {
    nextId = undefined;
  }

  const next = findStep(sequence, nextId);
  if (!next) {
    return {
      executedStep: current,
      enrolment: {
        ...enrolment,
        history,
        status: 'completed',
        completedAt: nowIso(),
        currentStepId: undefined,
        dueAt: undefined,
        context: ctx,
      },
    };
  }

  const dueAt = new Date(Date.now() + (next.delayHours ?? 0) * 3_600_000).toISOString();
  return {
    executedStep: current,
    nextStep: next,
    enrolment: {
      ...enrolment,
      history,
      currentStepId: next.id,
      dueAt,
      context: ctx,
    },
  };
}

export function pauseEnrolment(enrolment: SequenceEnrolment): SequenceEnrolment {
  return enrolment.status === 'active' ? { ...enrolment, status: 'paused' } : enrolment;
}

export function resumeEnrolment(enrolment: SequenceEnrolment): SequenceEnrolment {
  return enrolment.status === 'paused' ? { ...enrolment, status: 'active' } : enrolment;
}

/**
 * Stop an enrolment early — typical when the contact replies or books a meeting.
 */
export function stopEnrolment(
  enrolment: SequenceEnrolment,
  reason?: string,
): SequenceEnrolment {
  if (enrolment.status === 'completed' || enrolment.status === 'stopped') return enrolment;
  return {
    ...enrolment,
    status: 'stopped',
    completedAt: nowIso(),
    context: { ...(enrolment.context ?? {}), stopReason: reason },
  };
}

export function isStepDue(enrolment: SequenceEnrolment, now: Date = new Date()): boolean {
  if (enrolment.status !== 'active') return false;
  if (!enrolment.dueAt) return false;
  return new Date(enrolment.dueAt).getTime() <= now.getTime();
}
