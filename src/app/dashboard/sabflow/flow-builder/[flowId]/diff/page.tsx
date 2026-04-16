'use client';

/**
 * SabFlow — Flow version diff page
 *
 * /dashboard/sabflow/flow-builder/[flowId]/diff?from={versionId}&to={versionId|current}
 *
 * Fetches both snapshots client-side and renders the shared `FlowDiffView`.
 * Provides "Restore from left" and "Restore from right" actions which call
 * the existing `/api/sabflow/[flowId]/versions/[versionId]/restore` route.
 *
 * Uses react-icons/lu only.  No lucide-react.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  LuArrowLeft,
  LuLoader,
  LuRotateCcw,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { FlowDiffView } from '@/components/sabflow/diff/FlowDiffView';
import { getSabFlow } from '@/app/actions/sabflow';

/* ── Types ──────────────────────────────────────────────────────────────── */

/**
 * Shape returned by /api/sabflow/[flowId]/versions/[versionId].
 * The snapshot is JSON-serialised, so `_id` fields are strings rather than
 * ObjectId instances — we cast through `unknown` before using it as
 * SabFlowDoc for the diff (which only reads plain fields).
 */
interface VersionApiResponse {
  version: {
    _id: string;
    flowId: string;
    label: string;
    savedAt: string;
    snapshot: SabFlowDoc;
    userId: string;
  };
}

interface LoadedSnapshot {
  /** Display label — e.g. "Current", "Draft — 3h ago". */
  label: string;
  /** Version id, or `null` for the current live flow. */
  versionId: string | null;
  /** Flow document itself (always present when loaded). */
  flow: SabFlowDoc;
}

interface LoadState {
  before: LoadedSnapshot | null;
  after: LoadedSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function fetchFlow(flowId: string): Promise<SabFlowDoc> {
  // Server action — returns a JSON-serialised SabFlowDoc, or `null` when
  // not found / unauthorised.
  const result = (await getSabFlow(flowId)) as (SabFlowDoc & { _id: string }) | null;
  if (!result) {
    throw new Error('Flow not found or not accessible.');
  }
  return result;
}

async function fetchVersion(flowId: string, versionId: string): Promise<VersionApiResponse['version']> {
  const res = await fetch(`/api/sabflow/${flowId}/versions/${versionId}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load version (${res.status})`);
  }
  const data = (await res.json()) as VersionApiResponse;
  return data.version;
}

function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ── Restore confirm dialog ─────────────────────────────────────────────── */

interface RestoreConfirmProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRestoring: boolean;
}

function RestoreConfirm({ label, onConfirm, onCancel, isRestoring }: RestoreConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={isRestoring ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--gray-5)] bg-[var(--gray-1)] p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
            <LuTriangleAlert className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--gray-12)]">
              Restore this version?
            </p>
            <p className="mt-1 text-[12px] text-[var(--gray-10)] leading-relaxed">
              Restoring{' '}
              <span className="font-medium text-[var(--gray-12)]">&ldquo;{label}&rdquo;</span>{' '}
              will overwrite your current flow. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRestoring}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRestoring}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-70"
          >
            {isRestoring
              ? <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              : <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />}
            {isRestoring ? 'Restoring…' : 'Yes, restore'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function FlowDiffPage() {
  const router = useRouter();
  const params = useParams<{ flowId: string }>();
  const searchParams = useSearchParams();
  const flowId = params.flowId;

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const [state, setState] = useState<LoadState>({
    before: null,
    after: null,
    isLoading: true,
    error: null,
  });

  // Restore workflow state
  const [confirming, setConfirming] = useState<null | 'before' | 'after'>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  /* ── Load snapshots ─────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!fromParam || !toParam) {
        setState({
          before: null,
          after: null,
          isLoading: false,
          error:
            'Missing query parameters. Expected ?from={versionId}&to={versionId|current}.',
        });
        return;
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const [beforeRes, afterRes] = await Promise.all([
          loadSide(flowId, fromParam),
          loadSide(flowId, toParam),
        ]);

        if (cancelled) return;

        setState({
          before: beforeRes,
          after: afterRes,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          before: null,
          after: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load versions',
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [flowId, fromParam, toParam]);

  /* ── Restore handler ────────────────────────────────────── */

  const handleRestore = useCallback(async () => {
    if (!confirming) return;
    const side = confirming === 'before' ? state.before : state.after;
    if (!side) return;

    // Can't "restore" the current live flow — it's already current.
    if (side.versionId === null) {
      setConfirming(null);
      return;
    }

    setIsRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch(
        `/api/sabflow/${flowId}/versions/${side.versionId}/restore`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to restore version');
      }
      setConfirming(null);
      // Navigate back to the editor — the editor reloads the flow doc.
      router.push(`/dashboard/sabflow/flow-builder/${flowId}`);
      router.refresh();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setIsRestoring(false);
    }
  }, [confirming, state.before, state.after, flowId, router]);

  /* ── Pending confirm dialog ─────────────────────────────── */

  const pendingLabel = useMemo(() => {
    if (!confirming) return '';
    const side = confirming === 'before' ? state.before : state.after;
    return side?.label ?? '';
  }, [confirming, state.before, state.after]);

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div className="flex min-h-screen flex-col bg-[var(--gray-2)] text-[var(--gray-12)]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--gray-5)] bg-[var(--gray-1)]/90 px-4 py-3 backdrop-blur-md">
        <Link
          href={`/dashboard/sabflow/flow-builder/${flowId}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          aria-label="Back to flow editor"
        >
          <LuArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--gray-12)]">
            Compare flow versions
          </p>
          <p className="text-[11.5px] text-[var(--gray-9)] truncate">
            {state.before?.label ?? '…'}
            {' → '}
            {state.after?.label ?? '…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming('before')}
            disabled={!state.before || state.before.versionId === null || state.isLoading}
            title="Replace current flow with the left-hand version"
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] transition-colors',
              'hover:bg-[var(--gray-3)] disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Restore from left
          </button>
          <button
            type="button"
            onClick={() => setConfirming('after')}
            disabled={!state.after || state.after.versionId === null || state.isLoading}
            title="Replace current flow with the right-hand version"
            className={cn(
              'flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors',
              'hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Restore from right
          </button>
        </div>
      </header>

      {/* ── Restore error banner ───────────────────────────── */}
      {restoreError && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30">
          <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-500" strokeWidth={2} />
          <p className="flex-1 min-w-0 truncate text-[11.5px] text-red-600 dark:text-red-400">
            {restoreError}
          </p>
          <button
            type="button"
            onClick={() => setRestoreError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            <LuX className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────── */}
      <main className="flex-1 p-4">
        {state.isLoading ? (
          <div className="flex items-center justify-center py-24">
            <LuLoader className="h-6 w-6 animate-spin text-[var(--gray-8)]" strokeWidth={2} />
          </div>
        ) : state.error ? (
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400">
              <LuTriangleAlert className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="text-[12.5px] font-medium text-red-700 dark:text-red-300">
              Could not load diff
            </p>
            <p className="text-[11.5px] text-red-600/80 dark:text-red-400/80">{state.error}</p>
          </div>
        ) : state.before && state.after ? (
          <div className="mx-auto max-w-6xl">
            <FlowDiffView
              before={state.before.flow}
              after={state.after.flow}
              beforeLabel={state.before.label}
              afterLabel={state.after.label}
            />
          </div>
        ) : null}
      </main>

      {/* ── Restore confirmation ───────────────────────────── */}
      {confirming && (
        <RestoreConfirm
          label={pendingLabel}
          isRestoring={isRestoring}
          onConfirm={() => void handleRestore()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

/* ── Side loader ────────────────────────────────────────────────────────── */

async function loadSide(flowId: string, token: string): Promise<LoadedSnapshot> {
  if (token === 'current') {
    const flow = await fetchFlow(flowId);
    return { label: 'Current', versionId: null, flow };
  }

  const version = await fetchVersion(flowId, token);
  const savedAt = new Date(version.savedAt);
  const label = `${version.label} · ${relativeTime(savedAt)}`;
  return { label, versionId: version._id, flow: version.snapshot };
}
