/**
 * SabFlow client SDK — public API surface.
 *
 * This barrel is the *only* import path consumers should use:
 *
 *     import { SabFlowProvider, useSabFlowDoc } from '@/lib/sabflow/client';
 *
 * Sibling files are re-exported with explicit `export * from './x'` so that
 * a missing implementation file becomes a hard build failure rather than a
 * silent undefined import — that signal is intentional.
 *
 * See `./README.md` for usage and the foundation ADRs linked there.
 */

// ---------------------------------------------------------------------------
// React context + provider
// ---------------------------------------------------------------------------
export * from './SabFlowProvider';

// ---------------------------------------------------------------------------
// Doc subscription hooks
// ---------------------------------------------------------------------------
export * from './useSabFlowDoc';

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------
export {
  usePresence,
  type AwarenessLike,
  type AwarenessFactory,
} from './usePresence';

// ---------------------------------------------------------------------------
// Undo / migrations
// ---------------------------------------------------------------------------
export {
  SabFlowUndoManager,
  type SabFlowUndoManagerOptions,
  type YUndoManagerOptions,
  type YUndoManagerEvent,
} from './undo-redo';
export * from './schema-migrate';

// ---------------------------------------------------------------------------
// Offline + optimistic buffers (classes)
// ---------------------------------------------------------------------------
export * from './offline-queue';
export {
  OptimisticBuffer,
  NACK_REASON,
  UPDATE_ID_BYTES,
  DEFAULT_PENDING_CAP,
  type OptimisticBufferOptions,
  type RollbackEventDetail,
  type ConfirmedEventDetail,
  type DroppedEventDetail,
  type ApplyHandle,
} from './optimistic';

// ---------------------------------------------------------------------------
// Error boundary + UX toasts
// ---------------------------------------------------------------------------
export * from './SabFlowErrorBoundary';
export {
  toastConflictRejected,
  toastDisconnected,
  toastSeatLimit,
} from './toasts';

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------
export { track } from './telemetry';

// ---------------------------------------------------------------------------
// Shared types — re-exported as type-only to avoid runtime cost.
// ---------------------------------------------------------------------------
export type { PresenceState } from './usePresence';
export type { SabFlowConnectionStatus as ConnectionStatus } from './SabFlowProvider';
export type { NackReason } from './optimistic';
export type { Migration } from '../migrations';

