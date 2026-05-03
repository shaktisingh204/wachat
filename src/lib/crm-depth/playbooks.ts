/**
 * Structured playbook execution — a "next-best-action" engine.
 *
 * A playbook describes ordered steps with optional `enterWhen` guards and
 * `next` branches. The runtime walks the graph, evaluating guards against
 * a context object, and surfaces the recommended next step(s) for the caller
 * to render in UI or auto-execute.
 */
import type {
  Playbook,
  PlaybookStep,
  SequenceCondition,
} from './types';
import { evaluateCondition } from './sequences';

function getStep(pb: Playbook, id: string): PlaybookStep | undefined {
  return pb.steps.find(s => s.id === id);
}

function passesGuards(
  guards: SequenceCondition[] | undefined,
  ctx: Record<string, unknown>,
): boolean {
  if (!guards || guards.length === 0) return true;
  return guards.every(g => evaluateCondition(g, ctx));
}

export interface PlaybookExecutionState {
  playbookId: string;
  /** Step ids already completed. */
  completed: string[];
  /** Currently active step id (the user's WIP). */
  currentStepId?: string;
  context: Record<string, unknown>;
  startedAt: string;
  updatedAt?: string;
  finishedAt?: string;
}

export function startPlaybook(
  pb: Playbook,
  context: Record<string, unknown> = {},
): PlaybookExecutionState {
  if (!pb.active) throw new Error(`playbook ${pb.id} is inactive`);
  const first = pb.steps.find(s => passesGuards(s.enterWhen, context)) ?? pb.steps[0];
  return {
    playbookId: pb.id,
    completed: [],
    currentStepId: first?.id,
    context,
    startedAt: new Date().toISOString(),
  };
}

export interface NextBestActions {
  current?: PlaybookStep;
  recommendations: PlaybookStep[];
  /** When true, no further actions remain — playbook is finished. */
  done: boolean;
}

/**
 * Compute the next-best-actions for a given execution state. Returns the
 * step the user is currently on plus up to N recommended follow-up steps
 * resolved through the `next` graph.
 */
export function nextBestActions(
  pb: Playbook,
  state: PlaybookExecutionState,
  limit = 3,
): NextBestActions {
  const current = state.currentStepId ? getStep(pb, state.currentStepId) : undefined;
  if (!current) {
    return { recommendations: [], done: true };
  }

  const seen = new Set<string>([...state.completed, current.id]);
  const recommendations: PlaybookStep[] = [];

  const queue: string[] = [...(current.next ?? [])];
  while (queue.length > 0 && recommendations.length < limit) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const step = getStep(pb, id);
    if (!step) continue;
    if (!passesGuards(step.enterWhen, state.context)) continue;
    recommendations.push(step);
    if (step.next) queue.push(...step.next);
  }

  return { current, recommendations, done: false };
}

/**
 * Mark the current step complete and advance the state to the first
 * eligible recommendation (or finish if none).
 */
export function completeCurrentStep(
  pb: Playbook,
  state: PlaybookExecutionState,
): PlaybookExecutionState {
  if (!state.currentStepId) return state;
  const completed = [...state.completed, state.currentStepId];
  const nba = nextBestActions(pb, { ...state, completed }, 1);
  const next = nba.recommendations[0];
  return {
    ...state,
    completed,
    currentStepId: next?.id,
    updatedAt: new Date().toISOString(),
    finishedAt: next ? undefined : new Date().toISOString(),
  };
}

/**
 * Skip the current step (without marking it complete) — moves to the first
 * eligible recommendation.
 */
export function skipCurrentStep(
  pb: Playbook,
  state: PlaybookExecutionState,
): PlaybookExecutionState {
  if (!state.currentStepId) return state;
  const nba = nextBestActions(pb, state, 1);
  const next = nba.recommendations[0];
  return {
    ...state,
    currentStepId: next?.id,
    updatedAt: new Date().toISOString(),
    finishedAt: next ? undefined : new Date().toISOString(),
  };
}

/**
 * Compute completion percentage (0-100) for a playbook execution.
 */
export function progress(pb: Playbook, state: PlaybookExecutionState): number {
  if (pb.steps.length === 0) return 100;
  return Math.round((state.completed.length / pb.steps.length) * 100);
}
