/**
 * Per-node execution data store — n8n-style.
 *
 * Tracks input / output / pinned output / status / last test result for
 * every block the engine or the Test Node panel has touched.
 *
 * Consumed by:
 *   - NodeStatusBadge (fine-grained `status` subscription per node)
 *   - TestNodePanel   (recordResult, entries[blockId].lastResult)
 *   - PinDataButton   (entries[blockId].pinnedOutput + pinData/unpinData)
 *   - NodeDataInspector
 */

import { create } from 'zustand';

/* ── Types ───────────────────────────────────────────────────────── */

export type NodeExecutionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'waiting';

export type TestLogLevel = 'log' | 'warn' | 'error';

export interface NodeTestLog {
  level: TestLogLevel;
  message: string;
}

export interface NodeTestResult {
  output: unknown;
  logs: NodeTestLog[];
  durationMs: number;
  error?: string;
  /** Epoch millis when this run completed. */
  ranAt: number;
}

export interface NodeEntry {
  nodeId: string;
  status: NodeExecutionStatus;
  /** Last input observed by the engine or the Test Node panel. */
  lastInput?: unknown;
  /** Last successful output (pinned output takes priority when present). */
  lastOutput?: unknown;
  /** Manually pinned output — survives `clearAll`. */
  pinnedOutput?: unknown;
  /** Last raw test-run result, used to repopulate the panel on re-open. */
  lastResult?: NodeTestResult;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  executionTimeMs?: number;
}

/** Back-compat alias — some engine code imports this name. */
export type NodeExecutionData = NodeEntry & {
  input: unknown;
  output: unknown;
  parameters: Record<string, unknown>;
};

/* ── Store shape ─────────────────────────────────────────────────── */

interface NodeDataStoreState {
  /** Keyed by block / node id. */
  entries: Record<string, NodeEntry>;
  /** Back-compat — mirror of entries keyed as a Map for NodeStatusBadge. */
  data: Map<string, NodeEntry>;

  /* actions */
  setStatus: (
    nodeId: string,
    status: NodeExecutionStatus,
    extras?: { error?: string; output?: unknown; input?: unknown },
  ) => void;
  recordResult: (
    nodeId: string,
    result: NodeTestResult,
    input?: unknown,
  ) => void;
  pinData: (nodeId: string, value: unknown) => void;
  unpinData: (nodeId: string) => void;
  clearAll: () => void;

  /* back-compat — older code paths still call these */
  setNodeData: (nodeId: string, patch: Partial<NodeEntry>) => void;
  updateNodeStatus: (
    nodeId: string,
    status: NodeExecutionStatus,
    extras?: { error?: string; output?: unknown },
  ) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function emptyEntry(nodeId: string): NodeEntry {
  return { nodeId, status: 'idle' };
}

function patchEntry(
  entries: Record<string, NodeEntry>,
  nodeId: string,
  patch: Partial<NodeEntry>,
): Record<string, NodeEntry> {
  const existing = entries[nodeId] ?? emptyEntry(nodeId);
  return { ...entries, [nodeId]: { ...existing, ...patch, nodeId } };
}

function syncMap(
  entries: Record<string, NodeEntry>,
): Map<string, NodeEntry> {
  return new Map(Object.entries(entries));
}

/* ── Store ───────────────────────────────────────────────────────── */

export const useNodeDataStore = create<NodeDataStoreState>()((set) => ({
  entries: {},
  data: new Map(),

  setStatus: (nodeId, status, extras) => {
    set((s) => {
      const existing = s.entries[nodeId] ?? emptyEntry(nodeId);
      const now = Date.now();
      const patch: Partial<NodeEntry> = { status };

      if (status === 'running') {
        patch.startedAt = now;
        patch.completedAt = undefined;
        patch.executionTimeMs = undefined;
        patch.error = undefined;
      }

      if (status === 'success' || status === 'error') {
        patch.completedAt = now;
        if (existing.startedAt !== undefined) {
          patch.executionTimeMs = now - existing.startedAt;
        }
      }

      if (extras?.error !== undefined) patch.error = extras.error;
      if (extras?.output !== undefined) {
        patch.lastOutput = extras.output;
      }
      if (extras?.input !== undefined) {
        patch.lastInput = extras.input;
      }

      const entries = patchEntry(s.entries, nodeId, patch);
      return { entries, data: syncMap(entries) };
    });
  },

  recordResult: (nodeId, result, input) => {
    set((s) => {
      const patch: Partial<NodeEntry> = {
        status: result.error ? 'error' : 'success',
        lastResult: result,
        lastOutput: result.output,
        error: result.error,
        completedAt: result.ranAt,
        executionTimeMs: result.durationMs,
      };
      if (input !== undefined) patch.lastInput = input;
      const entries = patchEntry(s.entries, nodeId, patch);
      return { entries, data: syncMap(entries) };
    });
  },

  pinData: (nodeId, value) => {
    set((s) => {
      const entries = patchEntry(s.entries, nodeId, { pinnedOutput: value });
      return { entries, data: syncMap(entries) };
    });
  },

  unpinData: (nodeId) => {
    set((s) => {
      const existing = s.entries[nodeId];
      if (!existing || existing.pinnedOutput === undefined) return {};
      const entries = patchEntry(s.entries, nodeId, { pinnedOutput: undefined });
      return { entries, data: syncMap(entries) };
    });
  },

  clearAll: () => {
    set((s) => {
      // Preserve pinned values through a clear.
      const preserved: Record<string, NodeEntry> = {};
      for (const [id, entry] of Object.entries(s.entries)) {
        if (entry.pinnedOutput !== undefined) {
          preserved[id] = { nodeId: id, status: 'idle', pinnedOutput: entry.pinnedOutput };
        }
      }
      return { entries: preserved, data: syncMap(preserved) };
    });
  },

  /* ── Back-compat aliases ───────────────────────────────────── */

  setNodeData: (nodeId, patch) => {
    set((s) => {
      const entries = patchEntry(s.entries, nodeId, patch);
      return { entries, data: syncMap(entries) };
    });
  },

  updateNodeStatus: (nodeId, status, extras) => {
    set((s) => {
      const existing = s.entries[nodeId] ?? emptyEntry(nodeId);
      const now = Date.now();
      const patch: Partial<NodeEntry> = { status };
      if (status === 'running') {
        patch.startedAt = now;
        patch.completedAt = undefined;
        patch.executionTimeMs = undefined;
        patch.error = undefined;
      }
      if (status === 'success' || status === 'error') {
        patch.completedAt = now;
        if (existing.startedAt !== undefined) {
          patch.executionTimeMs = now - existing.startedAt;
        }
      }
      if (extras?.error !== undefined) patch.error = extras.error;
      if (extras?.output !== undefined) patch.lastOutput = extras.output;
      const entries = patchEntry(s.entries, nodeId, patch);
      return { entries, data: syncMap(entries) };
    });
  },
}));

/* ── Non-reactive getters ─────────────────────────────────────────── */

/** Returns the last input observed for this node, or undefined. */
export function getLastInput(nodeId: string): unknown {
  return useNodeDataStore.getState().entries[nodeId]?.lastInput;
}

/** Returns the pinned output for this node, or undefined. */
export function getPinnedOutput(nodeId: string): unknown {
  return useNodeDataStore.getState().entries[nodeId]?.pinnedOutput;
}

/** Non-reactive snapshot — safe from non-React engine code. */
export const nodeDataSnapshot = () => useNodeDataStore.getState();
