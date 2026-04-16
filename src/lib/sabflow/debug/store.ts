/**
 * SabFlow debug store — Zustand state for the flow-inspector / debug console.
 *
 * The store is pure client state (no SSR coupling) and is subscribed to
 * by the DebugConsolePanel.  It is intentionally lightweight:
 *
 *   - push* actions append entries.
 *   - clearDebugSession / pause / resume are convenience controls.
 *   - When `paused` is true, push* actions are no-ops.
 *
 * Components that don't render the console MUST NOT subscribe to the
 * store — the instrumentation helpers below only read the non-reactive
 * snapshot via `getState()`, so the store stays cheap when idle.
 */

import { create } from 'zustand';
import type {
  DebugLog,
  DebugLogLevel,
  DebugNetworkRequest,
  DebugSession,
  DebugStep,
  DebugVariableHistoryEntry,
  DebugVariableState,
} from './types';

const MAX_STEPS = 500;
const MAX_LOGS = 500;
const MAX_NETWORK = 200;
const MAX_VAR_HISTORY = 50;

/** Slice the most-recent `limit` items — avoids unbounded memory. */
function clamp<T>(arr: T[], limit: number): T[] {
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Store shape ─────────────────────────────────────────────────── */

interface DebugStoreState extends DebugSession {
  /** Paused mode — stops further ingestion but keeps existing data. */
  paused: boolean;
  /** When true, whoever mounts the console should subscribe. */
  active: boolean;

  /* actions */
  pushStep: (step: Omit<DebugStep, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => string;
  updateStep: (id: string, patch: Partial<DebugStep>) => void;
  pushLog: (log: Omit<DebugLog, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) => void;
  pushNetworkRequest: (
    req: Omit<DebugNetworkRequest, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
  ) => string;
  updateNetworkRequest: (id: string, patch: Partial<DebugNetworkRequest>) => void;
  setVariable: (name: string, value: unknown) => void;
  clearDebugSession: () => void;
  pauseDebug: () => void;
  resumeDebug: () => void;
  setActive: (active: boolean) => void;
  exportSessionJson: () => string;
}

export const useDebugStore = create<DebugStoreState>()((set, get) => ({
  steps: [],
  variables: {},
  logs: [],
  network: [],
  paused: false,
  active: false,

  pushStep: (input) => {
    if (get().paused) return input.id ?? '';
    const step: DebugStep = {
      id: input.id ?? randomId(),
      timestamp: input.timestamp ?? Date.now(),
      blockType: input.blockType,
      label: input.label,
      groupId: input.groupId,
      groupName: input.groupName,
      blockId: input.blockId,
      duration: input.duration,
      options: input.options,
      inputs: input.inputs,
      outputs: input.outputs,
      error: input.error,
    };
    set((s) => ({ steps: clamp([...s.steps, step], MAX_STEPS) }));
    return step.id;
  },

  updateStep: (id, patch) => {
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    }));
  },

  pushLog: (input) => {
    if (get().paused) return;
    const log: DebugLog = {
      id: input.id ?? randomId(),
      timestamp: input.timestamp ?? Date.now(),
      level: input.level,
      source: input.source,
      message: input.message,
      data: input.data,
    };
    set((s) => ({ logs: clamp([...s.logs, log], MAX_LOGS) }));
  },

  pushNetworkRequest: (input) => {
    if (get().paused) return input.id ?? '';
    const req: DebugNetworkRequest = {
      id: input.id ?? randomId(),
      timestamp: input.timestamp ?? Date.now(),
      method: input.method,
      url: input.url,
      status: input.status,
      duration: input.duration,
      requestHeaders: input.requestHeaders,
      requestBody: input.requestBody,
      responseHeaders: input.responseHeaders,
      responseBody: input.responseBody,
      error: input.error,
    };
    set((s) => ({ network: clamp([...s.network, req], MAX_NETWORK) }));
    return req.id;
  },

  updateNetworkRequest: (id, patch) => {
    set((s) => ({
      network: s.network.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  },

  setVariable: (name, value) => {
    if (get().paused) return;
    const now = Date.now();
    set((s) => {
      const existing: DebugVariableState | undefined = s.variables[name];
      const previous = existing?.current;
      // Skip if value unchanged (deep-compare for primitives only — ok for UI).
      if (existing && Object.is(existing.current, value)) return {};
      const historyEntry: DebugVariableHistoryEntry = { timestamp: now, value };
      const history = clamp(
        existing ? [...existing.history, historyEntry] : [historyEntry],
        MAX_VAR_HISTORY,
      );
      const next: DebugVariableState = {
        current: value,
        previous,
        lastChangedAt: now,
        history,
      };
      return { variables: { ...s.variables, [name]: next } };
    });
  },

  clearDebugSession: () => {
    set({ steps: [], variables: {}, logs: [], network: [] });
  },

  pauseDebug: () => set({ paused: true }),
  resumeDebug: () => set({ paused: false }),

  setActive: (active) => set({ active }),

  exportSessionJson: () => {
    const { steps, variables, logs, network } = get();
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), steps, variables, logs, network },
      null,
      2,
    );
  },
}));

/** Non-reactive snapshot — safe to call from instrumentation helpers. */
export const debugSnapshot = () => useDebugStore.getState();
