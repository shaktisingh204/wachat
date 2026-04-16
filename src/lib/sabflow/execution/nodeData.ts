/**
 * SabFlow node-data store — per-block runtime inspection cache.
 *
 * This is an n8n-style "node data" memory that remembers the last observed
 * input + output (and optional pinned output) for every block id in a flow.
 * It is client-only Zustand state — nothing is persisted across reloads.
 *
 * It is intentionally separate from the debug store:
 *   - The debug store records *session* traces (steps, logs, network).
 *   - The node-data store records *per-node* sample values so the Test-Node
 *     panel can prefill inputs, reuse pinned outputs downstream, and show
 *     the last execution result inline inside the block settings panel.
 *
 * Callers must not mutate returned objects; always replace via setters.
 */

import { create } from 'zustand';

/* ── Public data shapes ──────────────────────────────────────────────────── */

export type NodeTestLog = {
  level: 'log' | 'warn' | 'error';
  message: string;
};

export type NodeTestResult = {
  /** Arbitrary JSON-serialisable output returned by testNode. */
  output: unknown;
  /** Collected console-style logs from the run. */
  logs: NodeTestLog[];
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Human-readable error message when the run failed. */
  error?: string;
  /** Wall-clock timestamp (ms since epoch) when the run completed. */
  ranAt: number;
};

export type NodeDataEntry = {
  /** Last input value fed into the block (from a real run or manual test). */
  lastInput?: unknown;
  /** Last output value produced by the block. */
  lastOutput?: unknown;
  /** Pinned output — when set, downstream test runs read this value instead. */
  pinnedOutput?: unknown;
  /** The most recent test-node result, if any. */
  lastResult?: NodeTestResult;
};

/* ── Store shape ─────────────────────────────────────────────────────────── */

type NodeDataMap = Record<string, NodeDataEntry>;

interface NodeDataState {
  /** Map of blockId → cached data entry. */
  entries: NodeDataMap;

  /** Replace the entry for a single block (shallow merge). */
  setEntry: (blockId: string, patch: Partial<NodeDataEntry>) => void;

  /** Record the result of a Test-Node run. */
  recordResult: (
    blockId: string,
    result: NodeTestResult,
    input?: unknown,
  ) => void;

  /** Pin the last output for a block so downstream tests reuse it. */
  pinData: (blockId: string, value: unknown) => void;

  /** Remove a pinned output. */
  unpinData: (blockId: string) => void;

  /** Drop the entry for a single block (e.g. when the block is deleted). */
  clearBlock: (blockId: string) => void;

  /** Wipe every entry — used when a new flow is opened. */
  clearAll: () => void;
}

/* ── Store ───────────────────────────────────────────────────────────────── */

export const useNodeDataStore = create<NodeDataState>((set) => ({
  entries: {},

  setEntry: (blockId, patch) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [blockId]: { ...state.entries[blockId], ...patch },
      },
    })),

  recordResult: (blockId, result, input) =>
    set((state) => {
      const prev = state.entries[blockId] ?? {};
      return {
        entries: {
          ...state.entries,
          [blockId]: {
            ...prev,
            lastInput: input !== undefined ? input : prev.lastInput,
            lastOutput: result.output,
            lastResult: result,
          },
        },
      };
    }),

  pinData: (blockId, value) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [blockId]: { ...state.entries[blockId], pinnedOutput: value },
      },
    })),

  unpinData: (blockId) =>
    set((state) => {
      const prev = state.entries[blockId];
      if (!prev) return state;
      const { pinnedOutput: _removed, ...rest } = prev;
      void _removed;
      return {
        entries: { ...state.entries, [blockId]: rest },
      };
    }),

  clearBlock: (blockId) =>
    set((state) => {
      if (!(blockId in state.entries)) return state;
      const next: NodeDataMap = { ...state.entries };
      delete next[blockId];
      return { entries: next };
    }),

  clearAll: () => set({ entries: {} }),
}));

/* ── Non-reactive snapshot helpers ───────────────────────────────────────── */

/**
 * Return the effective output for a block — preferring its pinned value when
 * present, else the last recorded output. Returns `undefined` when neither
 * exists.  Non-reactive: safe to call inside plain functions / effects.
 */
export function getEffectiveOutput(blockId: string): unknown {
  const entry = useNodeDataStore.getState().entries[blockId];
  if (!entry) return undefined;
  return entry.pinnedOutput !== undefined ? entry.pinnedOutput : entry.lastOutput;
}

/** Return the last input observed for a block, or undefined. */
export function getLastInput(blockId: string): unknown {
  return useNodeDataStore.getState().entries[blockId]?.lastInput;
}

/** Return the pinned output for a block, or undefined. */
export function getPinnedOutput(blockId: string): unknown {
  return useNodeDataStore.getState().entries[blockId]?.pinnedOutput;
}
