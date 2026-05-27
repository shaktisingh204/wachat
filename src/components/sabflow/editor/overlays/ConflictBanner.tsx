/**
 * SabFlow editor — Conflict Banner overlay.
 *
 * Track A · Phase 6 · sub-task 9/10.
 *
 * What this owns
 * --------------
 * A top-of-editor banner + side-by-side diff modal that surfaces when a local
 * optimistic write was rolled back by the server (sibling 'rollback' event on
 * `OptimisticBuffer`). The user can:
 *
 *   - View a JSON diff of "Your draft" vs "Server state".
 *   - Discard their pending edit (default safe action).
 *   - Force-overwrite the server (admin role only; Phase 8 will plumb the
 *     real role-check — we leak a `canForceOverwrite` prop today).
 *
 * Auto-dismisses after 30s of no interaction. Also fires a domain toast via
 * `toastConflictRejected` for the non-modal "ack" path, and emits telemetry
 * events `sabflow.collab.conflict_viewed/.discarded/.force_overwritten`.
 *
 * Scope
 * -----
 * This file owns the React surface ONLY. It does NOT:
 *   - mutate the Yjs doc (parent / OptimisticBuffer owns rollback semantics)
 *   - persist a force-overwrite (Phase 8 will hand a callback in)
 *   - know about the wire / sync transport
 *
 * Zero new deps — TSX, native `<dialog>`-less modal (positioned div + focus
 * trap-lite), and Tailwind utility classes already in the design system.
 */
'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { OptimisticBuffer, RollbackEventDetail } from '@/lib/sabflow/client/optimistic';
import { toastConflictRejected } from '@/lib/sabflow/client/toasts';
import { track } from '@/lib/sabflow/client/telemetry';

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface ConflictSnapshot {
  /** Human-readable block label, e.g. "Send Email — Welcome". */
  readonly blockName: string;
  /** Stable id for telemetry / dedupe. Falls back to the rolled-back updateId. */
  readonly blockId?: string;
  /** The local-only state the user authored. */
  readonly draft: unknown;
  /** The state the server kept after rejecting the user's draft. */
  readonly server: unknown;
}

export interface ConflictBannerProps {
  /** Optimistic buffer to subscribe to. Banner shows on every 'rollback' event. */
  readonly optimisticBuffer: OptimisticBuffer;
  /**
   * Resolver invoked when a rollback event lands. Returns the human-friendly
   * snapshot to display, or `null` to swallow the event (banner won't show —
   * useful when the rollback is for a block the user already moved past).
   *
   * If omitted, the banner shows a generic "your last edit" message with no
   * diff (since we have no draft/server JSON to compare).
   */
  readonly resolveConflict?: (
    detail: RollbackEventDetail,
  ) => ConflictSnapshot | null;
  /**
   * Server-side admin gate. Phase 8 will wire this to the real RBAC check;
   * today the parent supplies a boolean. When false, "Force overwrite" is
   * hidden and Discard is the only path forward.
   */
  readonly canForceOverwrite?: boolean;
  /**
   * Called when the user clicks "Discard mine". Parent should ensure the
   * optimistic buffer / Yjs doc has fully reconciled to server state — the
   * buffer's `rollback()` already ran the undo closure, so this is usually a
   * no-op + close.
   */
  readonly onDiscard?: (detail: RollbackEventDetail) => void;
  /**
   * Called when an admin force-overwrites the server. Phase 8 hands this a
   * concrete writer; today it's optional and a no-op closes the banner.
   */
  readonly onForceOverwrite?: (detail: RollbackEventDetail) => void;
  /** Auto-dismiss timeout in ms. Defaults to 30 000. Set to 0 to disable. */
  readonly autoDismissMs?: number;
}

// ---------------------------------------------------------------------------
// Telemetry — bridge through the strongly-typed `track()` until the taxonomy
// is widened in a sibling task. The string events are stable and documented
// in the task spec; the runtime call is identical.
// ---------------------------------------------------------------------------

type LooseTrack = (event: string, props: Record<string, unknown>) => void;
const trackLoose = track as unknown as LooseTrack;

const EVT_VIEWED = 'sabflow.collab.conflict_viewed';
const EVT_DISCARDED = 'sabflow.collab.discarded';
const EVT_FORCED = 'sabflow.collab.force_overwritten';

// ---------------------------------------------------------------------------
// JSON pretty + line-level diff
// ---------------------------------------------------------------------------

const MAX_PRETTY_BYTES = 32 * 1024;

function safePretty(v: unknown): string {
  try {
    const out = JSON.stringify(v, null, 2);
    if (typeof out !== 'string') return String(v);
    if (out.length > MAX_PRETTY_BYTES) {
      return `${out.slice(0, MAX_PRETTY_BYTES)}\n… (truncated)`;
    }
    return out;
  } catch {
    return '/* unable to stringify */';
  }
}

type LineKind = 'same' | 'add' | 'del';
interface DiffLine {
  readonly kind: LineKind;
  readonly text: string;
}

/**
 * O(n) line-level diff — for the typical CRDT block-payload sizes (<10 KB)
 * a Set-based "is this line in the other side?" heuristic is fast and avoids
 * an LCS implementation. Good enough for visual highlighting; not a
 * semantically-perfect diff.
 */
function diffLines(left: string, right: string): {
  left: DiffLine[];
  right: DiffLine[];
} {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const leftSet = new Set(leftLines);
  const rightSet = new Set(rightLines);
  return {
    left: leftLines.map((text) => ({
      kind: rightSet.has(text) ? 'same' : 'del',
      text,
    })),
    right: rightLines.map((text) => ({
      kind: leftSet.has(text) ? 'same' : 'add',
      text,
    })),
  };
}

// ---------------------------------------------------------------------------
// Reason → user copy
// ---------------------------------------------------------------------------

function reasonLabel(reason: number): string {
  // Mirrors NACK_REASON in optimistic.ts; kept as inline literals so this
  // file doesn't import the runtime enum (slim import graph).
  switch (reason) {
    case 1:
      return 'rate-limited';
    case 2:
      return 'frame too large';
    case 3:
      return 'authentication expired';
    case 4:
      return 'block was locked';
    case 5:
      return 'internal server error';
    default:
      return 'server has a newer version';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActiveConflict {
  readonly detail: RollbackEventDetail;
  readonly snapshot: ConflictSnapshot | null;
}

export function ConflictBanner({
  optimisticBuffer,
  resolveConflict,
  canForceOverwrite = false,
  onDiscard,
  onForceOverwrite,
  autoDismissMs = 30_000,
}: ConflictBannerProps) {
  const [active, setActive] = useState<ActiveConflict | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // ---- timer helpers ----------------------------------------------------
  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismissTimer();
    setActive(null);
    setDiffOpen(false);
  }, [clearDismissTimer]);

  // ---- subscribe to 'rollback' -----------------------------------------
  useEffect(() => {
    const handler = (event: CustomEvent<RollbackEventDetail>) => {
      const detail = event.detail;
      const snapshot = resolveConflict ? resolveConflict(detail) : null;

      // Always emit the non-modal toast for accessibility-of-record.
      try {
        toastConflictRejected(reasonLabel(detail.reason));
      } catch {
        // toast must never break the host.
      }

      setActive({ detail, snapshot });
      setDiffOpen(false);

      // Arm auto-dismiss. 0 = disabled.
      clearDismissTimer();
      if (autoDismissMs > 0) {
        dismissTimer.current = setTimeout(() => {
          setActive(null);
          setDiffOpen(false);
          dismissTimer.current = null;
        }, autoDismissMs);
      }
    };

    optimisticBuffer.addEventListener('rollback', handler);
    return () => {
      optimisticBuffer.removeEventListener('rollback', handler);
      clearDismissTimer();
    };
  }, [optimisticBuffer, resolveConflict, autoDismissMs, clearDismissTimer]);

  // ---- modal focus + esc ------------------------------------------------
  useEffect(() => {
    if (!diffOpen) return;
    const prev = typeof document !== 'undefined' ? document.activeElement : null;
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setDiffOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev instanceof HTMLElement) {
        try {
          prev.focus();
        } catch {
          // ignore restore failures
        }
      }
    };
  }, [diffOpen]);

  // ---- actions ----------------------------------------------------------
  const handleView = useCallback(() => {
    if (!active) return;
    clearDismissTimer();
    setDiffOpen(true);
    trackLoose(EVT_VIEWED, {
      reason: active.detail.reason,
      updateId: active.detail.updateIdHex,
      blockId: active.snapshot?.blockId ?? active.detail.updateIdHex,
      hasSnapshot: active.snapshot !== null,
    });
  }, [active, clearDismissTimer]);

  const handleDiscard = useCallback(() => {
    if (!active) return;
    trackLoose(EVT_DISCARDED, {
      reason: active.detail.reason,
      updateId: active.detail.updateIdHex,
      blockId: active.snapshot?.blockId ?? active.detail.updateIdHex,
    });
    try {
      onDiscard?.(active.detail);
    } finally {
      dismiss();
    }
  }, [active, onDiscard, dismiss]);

  const handleForce = useCallback(() => {
    if (!active || !canForceOverwrite) return;
    trackLoose(EVT_FORCED, {
      reason: active.detail.reason,
      updateId: active.detail.updateIdHex,
      blockId: active.snapshot?.blockId ?? active.detail.updateIdHex,
    });
    try {
      onForceOverwrite?.(active.detail);
    } finally {
      dismiss();
    }
  }, [active, canForceOverwrite, onForceOverwrite, dismiss]);

  // ---- pretty + diff (memoised) ----------------------------------------
  const pretty = useMemo(() => {
    if (!active?.snapshot) return null;
    const leftStr = safePretty(active.snapshot.draft);
    const rightStr = safePretty(active.snapshot.server);
    return { leftStr, rightStr, ...diffLines(leftStr, rightStr) };
  }, [active]);

  if (!active) return null;

  const blockName = active.snapshot?.blockName ?? 'your last edit';
  const reasonText = reasonLabel(active.detail.reason);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Top banner                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="alert"
        aria-live="assertive"
        className="fixed left-1/2 top-3 z-40 flex max-w-[640px] -translate-x-1/2 items-center gap-3 rounded-lg border border-zoru-line/40 bg-zoru-surface-2 px-4 py-2.5 text-zoru-ink shadow-md dark:bg-zoru-ink/80 dark:text-white"
      >
        <span className="text-[13px] leading-snug">
          Your change to{' '}
          <span className="font-semibold">&ldquo;{blockName}&rdquo;</span>{' '}
          couldn&rsquo;t be saved — {reasonText}.
        </span>
        <button
          type="button"
          onClick={handleView}
          className="rounded-md border border-zoru-line/30 bg-white/60 px-2 py-1 text-[12px] font-medium text-zoru-ink transition hover:bg-white dark:bg-zoru-ink/40 dark:text-white dark:hover:bg-zoru-ink/60"
        >
          View diff
        </button>
        <button
          type="button"
          aria-label="Dismiss conflict banner"
          onClick={dismiss}
          className="rounded-md px-1.5 py-0.5 text-zoru-ink/70 hover:bg-zoru-surface-2/60 hover:text-zoru-ink dark:text-white/70 dark:hover:bg-zoru-ink/60"
        >
          {'×'}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Diff modal                                                          */}
      {/* ------------------------------------------------------------------ */}
      {diffOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            // backdrop click closes — don't bubble into editor
            if (e.target === e.currentTarget) setDiffOpen(false);
          }}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[80vh] w-full max-w-5xl flex-col rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-2xl outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--gray-5)] px-5 py-3.5">
              <div>
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold text-[var(--gray-12)]"
                >
                  Conflict on &ldquo;{blockName}&rdquo;
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--gray-10)]">
                  The server rejected your change ({reasonText}). Review the
                  difference and choose how to proceed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiffOpen(false)}
                aria-label="Close diff"
                className="rounded-md px-2 py-1 text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
              >
                {'×'}
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-4 md:grid-cols-2">
              <DiffPane title="Your draft" lines={pretty?.left ?? null} side="left" />
              <DiffPane title="Server state" lines={pretty?.right ?? null} side="right" />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--gray-5)] px-5 py-3">
              {canForceOverwrite ? (
                <button
                  type="button"
                  onClick={handleForce}
                  className="rounded-md border border-zoru-line/40 bg-zoru-surface-2 px-3 py-1.5 text-[12px] font-medium text-zoru-ink transition hover:bg-zoru-surface-2 dark:bg-zoru-ink/40 dark:text-white dark:hover:bg-zoru-ink/60"
                >
                  Force overwrite
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleDiscard}
                autoFocus
                className="rounded-md bg-[var(--gray-12)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-1)] transition hover:opacity-90"
              >
                Discard mine
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// DiffPane — extracted for readability + memo-friendliness
// ---------------------------------------------------------------------------

function DiffPane({
  title,
  lines,
  side,
}: {
  title: string;
  lines: DiffLine[] | null;
  side: 'left' | 'right';
}) {
  return (
    <section
      aria-label={title}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]"
    >
      <header className="border-b border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-11)]">
        {title}
      </header>
      <pre className="m-0 flex-1 overflow-auto p-0 text-[12px] leading-[1.55] text-[var(--gray-12)]">
        {lines === null ? (
          <div className="px-3 py-2 text-[var(--gray-10)]">
            No snapshot captured for this conflict.
          </div>
        ) : (
          lines.map((line, idx) => (
            <div
              key={`${side}-${idx}`}
              className={
                line.kind === 'same'
                  ? 'px-3'
                  : line.kind === 'add'
                    ? 'bg-zoru-ink/15 px-3'
                    : 'bg-zoru-ink/15 px-3'
              }
            >
              <span className="select-none pr-2 text-[var(--gray-9)]">
                {line.kind === 'same' ? ' ' : line.kind === 'add' ? '+' : '-'}
              </span>
              <span className="whitespace-pre-wrap break-words font-mono">
                {line.text === '' ? ' ' : line.text}
              </span>
            </div>
          ))
        )}
      </pre>
    </section>
  );
}
