/**
 * Instrumentation helpers — thin wrappers over the debug store that
 * make it easy to record execution events from anywhere (engine,
 * preview panel, script runner, webhook sender, etc.).
 *
 * These helpers read the store via `getState()` and therefore do NOT
 * cause re-renders.  They also short-circuit when the console is not
 * `active`, so they stay cheap in production when nobody is watching.
 */

import type { ExecutionStep } from '@/lib/sabflow/execution/types';
import { debugSnapshot } from './store';
import type {
  DebugLogLevel,
  DebugNetworkRequest,
  DebugStep,
} from './types';

/* ── ExecutionStep → DebugStep ───────────────────────────────────── */

/** Map an engine ExecutionStep into a DebugStep and push it. */
export function instrumentExecutionStep(
  step: ExecutionStep,
  extras?: {
    groupId?: string;
    groupName?: string;
    blockId?: string;
    duration?: number;
    options?: Record<string, unknown>;
    error?: string;
  },
): string {
  const store = debugSnapshot();
  if (!store.active) return '';

  const blockId =
    extras?.blockId ??
    (typeof step.payload.blockId === 'string'
      ? (step.payload.blockId as string)
      : undefined);

  const label = typeof step.payload.messageType === 'string'
    ? (step.payload.messageType as string)
    : step.type;

  return store.pushStep({
    blockType: mapExecutionStepType(step),
    label,
    groupId: extras?.groupId,
    groupName: extras?.groupName,
    blockId,
    duration: extras?.duration,
    options: extras?.options,
    inputs: undefined,
    outputs: { ...step.payload },
    error: extras?.error,
  });
}

function mapExecutionStepType(step: ExecutionStep): DebugStep['blockType'] {
  switch (step.type) {
    case 'message':
      return 'message';
    case 'input':
      return 'input';
    case 'condition_evaluated':
      return 'condition';
    case 'variable_set':
      return 'set_variable';
    case 'redirect':
      return 'redirect';
    default:
      return step.type;
  }
}

/* ── Generic step ─────────────────────────────────────────────────── */

export function instrumentStep(step: Omit<DebugStep, 'id' | 'timestamp'>): string {
  const store = debugSnapshot();
  if (!store.active) return '';
  return store.pushStep(step);
}

/* ── Variables ───────────────────────────────────────────────────── */

export function instrumentVariableUpdate(
  name: string,
  value: unknown,
  _previousValue?: unknown,
): void {
  const store = debugSnapshot();
  if (!store.active) return;
  // `previousValue` is derived from the existing store entry; the
  // parameter is accepted for API compatibility but not required.
  store.setVariable(name, value);
}

/** Bulk-seed variables (e.g. at session start). */
export function instrumentVariablesSeed(vars: Record<string, unknown>): void {
  const store = debugSnapshot();
  if (!store.active) return;
  for (const [k, v] of Object.entries(vars)) {
    store.setVariable(k, v);
  }
}

/* ── Logs ────────────────────────────────────────────────────────── */

export function instrumentLog(
  level: DebugLogLevel,
  source: string,
  message: string,
  data?: unknown,
): void {
  const store = debugSnapshot();
  if (!store.active) return;
  store.pushLog({ level, source, message, data });
}

/* ── Network requests ────────────────────────────────────────────── */

export function instrumentNetworkRequest(
  request: Omit<DebugNetworkRequest, 'id' | 'timestamp' | 'status' | 'duration' | 'responseHeaders' | 'responseBody' | 'error'>,
): string {
  const store = debugSnapshot();
  if (!store.active) return '';
  return store.pushNetworkRequest({ ...request });
}

export function instrumentNetworkResponse(
  id: string,
  response: {
    status?: number;
    duration?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    error?: string;
  },
): void {
  if (!id) return;
  const store = debugSnapshot();
  if (!store.active) return;
  store.updateNetworkRequest(id, response);
}
