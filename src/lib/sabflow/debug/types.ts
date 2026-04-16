/**
 * Debug / flow-inspector types.
 *
 * These are the shapes of entries pushed into the debug store while a
 * flow is running in the preview panel.  They intentionally store raw
 * JSON-serialisable payloads (inputs / outputs / bodies) so the console
 * can render them with pretty-printing.
 */

/* ── Step (timeline entry) ───────────────────────────────────────── */

export type DebugStepBlockType =
  | 'init'
  | 'message'
  | 'input'
  | 'condition'
  | 'set_variable'
  | 'jump'
  | 'redirect'
  | 'wait'
  | 'script'
  | 'webhook'
  | 'integration'
  | 'end'
  | 'error'
  | string;

export interface DebugStep {
  /** Stable unique id — usually `crypto.randomUUID()`. */
  id: string;
  /** Unix ms timestamp. */
  timestamp: number;
  /** Block type name (used for icon / label). */
  blockType: DebugStepBlockType;
  /** Human-readable label (block type or custom). */
  label?: string;
  /** Group id the block lives in (if any). */
  groupId?: string;
  /** Group name the block lives in (if any). */
  groupName?: string;
  /** Block id (if any). */
  blockId?: string;
  /** Milliseconds the step took to execute. */
  duration?: number;
  /** Raw options object for the block (used in expand). */
  options?: Record<string, unknown>;
  /** Inputs consumed by the step (e.g. user answer, resolved vars). */
  inputs?: Record<string, unknown>;
  /** Outputs produced by the step (e.g. message content, new var values). */
  outputs?: Record<string, unknown>;
  /** Error message if the step failed. */
  error?: string;
}

/* ── Log ─────────────────────────────────────────────────────────── */

export type DebugLogLevel = 'info' | 'warn' | 'error';

export interface DebugLog {
  id: string;
  timestamp: number;
  level: DebugLogLevel;
  /** Free-form source (e.g. "script:block-abc", "webhook:/api/x"). */
  source: string;
  message: string;
  /** Optional structured data serialised for display. */
  data?: unknown;
}

/* ── Variable history ────────────────────────────────────────────── */

export interface DebugVariableHistoryEntry {
  timestamp: number;
  value: unknown;
}

export interface DebugVariableState {
  current: unknown;
  previous?: unknown;
  /** Unix ms of the last change — used to highlight for ~2s. */
  lastChangedAt?: number;
  history: DebugVariableHistoryEntry[];
}

/* ── Network request ─────────────────────────────────────────────── */

export interface DebugNetworkRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  /** Undefined while the request is in flight. */
  status?: number;
  /** Response time in ms. */
  duration?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  error?: string;
}

/* ── Session (aggregate) ─────────────────────────────────────────── */

export interface DebugSession {
  steps: DebugStep[];
  variables: Record<string, DebugVariableState>;
  logs: DebugLog[];
  network: DebugNetworkRequest[];
}

/* ── Helpers ─────────────────────────────────────────────────────── */

export function emptyDebugSession(): DebugSession {
  return { steps: [], variables: {}, logs: [], network: [] };
}
