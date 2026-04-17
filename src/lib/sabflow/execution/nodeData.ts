/**
 * Per-node execution data store — n8n-style.
 *
 * Tracks Input / Output / Parameters + status for every block the engine
 * has touched during a run.  Consumed by the NodeDataInspector right-side
 * panel and the tiny status badges overlaid on canvas blocks.
 *
 * Pure client state (no SSR coupling).  Components that don't render the
 * inspector should NOT subscribe reactively — prefer `getState()` via
 * `nodeDataSnapshot()`.
 */

import { create } from 'zustand';

/* ── Types ───────────────────────────────────────────────────────── */

export type NodeExecutionStatus =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'waiting';

export interface NodeExecutionData {
  nodeId: string;
  input: unknown;
  output: unknown;
  parameters: Record<string, unknown>;
  status: NodeExecutionStatus;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  executionTimeMs?: number;
}

/* ── Store shape ─────────────────────────────────────────────────── */

interface NodeDataStoreState {
  /** Keyed by block / node id. */
  data: Map<string, NodeExecutionData>;
  /** Manually pinned outputs — survive `clearAll`. */
  pinnedData: Map<string, unknown>;

  /* actions */
  setNodeData: (nodeId: string, patch: Partial<NodeExecutionData>) => void;
  updateNodeStatus: (
    nodeId: string,
    status: NodeExecutionStatus,
    extras?: { error?: string; output?: unknown },
  ) => void;
  pinData: (nodeId: string, value: unknown) => void;
  unpinData: (nodeId: string) => void;
  clearAll: () => void;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function emptyEntry(nodeId: string): NodeExecutionData {
  return {
    nodeId,
    input: undefined,
    output: undefined,
    parameters: {},
    status: 'idle',
  };
}

/** Immutably clone and merge a Map entry. */
function withPatch(
  prev: Map<string, NodeExecutionData>,
  nodeId: string,
  patch: Partial<NodeExecutionData>,
): Map<string, NodeExecutionData> {
  const next = new Map(prev);
  const existing = prev.get(nodeId) ?? emptyEntry(nodeId);
  next.set(nodeId, { ...existing, ...patch, nodeId });
  return next;
}

/* ── Store ───────────────────────────────────────────────────────── */

export const useNodeDataStore = create<NodeDataStoreState>()((set) => ({
  data: new Map(),
  pinnedData: new Map(),

  setNodeData: (nodeId, patch) => {
    set((s) => ({ data: withPatch(s.data, nodeId, patch) }));
  },

  updateNodeStatus: (nodeId, status, extras) => {
    set((s) => {
      const existing = s.data.get(nodeId) ?? emptyEntry(nodeId);
      const now = Date.now();

      const patch: Partial<NodeExecutionData> = { status };

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
      if (extras?.output !== undefined) patch.output = extras.output;

      return { data: withPatch(s.data, nodeId, patch) };
    });
  },

  pinData: (nodeId, value) => {
    set((s) => {
      const next = new Map(s.pinnedData);
      next.set(nodeId, value);
      return { pinnedData: next };
    });
  },

  unpinData: (nodeId) => {
    set((s) => {
      if (!s.pinnedData.has(nodeId)) return {};
      const next = new Map(s.pinnedData);
      next.delete(nodeId);
      return { pinnedData: next };
    });
  },

  clearAll: () => {
    set({ data: new Map() });
  },
}));

/** Non-reactive snapshot — safe from non-React engine code. */
export const nodeDataSnapshot = () => useNodeDataStore.getState();
