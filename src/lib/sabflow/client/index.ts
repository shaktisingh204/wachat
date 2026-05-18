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
export * from './useSabFlowContext';

// ---------------------------------------------------------------------------
// Doc subscription hooks
// ---------------------------------------------------------------------------
export * from './useSabFlowDoc';
export * from './useSabFlowDocOrNull';

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------
export * from './usePresence';

// ---------------------------------------------------------------------------
// Undo / migrations
// ---------------------------------------------------------------------------
export * from './SabFlowUndoManager';
export * from './runMigrations';

// ---------------------------------------------------------------------------
// Offline + optimistic buffers (classes)
// ---------------------------------------------------------------------------
export * from './OfflineQueue';
export * from './OptimisticBuffer';

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
export type {
  PresenceState,
  ConnectionStatus,
  NackReason,
  Migration,
} from './types';
