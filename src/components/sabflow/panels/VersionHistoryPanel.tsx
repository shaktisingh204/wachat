'use client';

/**
 * VersionHistoryPanel
 *
 * Sliding right-side panel that lists saved versions of a SabFlow and
 * allows the user to restore any previous snapshot.
 *
 * Uses react-icons/lu only. No lucide-react.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuHistory,
  LuRotateCcw,
  LuX,
  LuPlus,
  LuCheck,
  LuLoader,
  LuTriangleAlert,
  LuClock,
  LuTag,
  LuGitCompare,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { SabFlowDoc } from '@/lib/sabflow/types';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface VersionSummary {
  _id: string;
  flowId: string;
  savedAt: string | Date;
  label: string;
  userId: string;
}

interface Props {
  flowId: string;
  onClose: () => void;
  /** Called with the restored flow doc so EditorPage can update its state. */
  onRestore: (flow: SabFlowDoc & { _id: string }) => void;
}

/* ── Relative-time helper ───────────────────────────────────────────────────── */

function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/* ── ConfirmDialog ──────────────────────────────────────────────────────────── */

interface ConfirmDialogProps {
  versionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ versionLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--gray-5)] bg-[var(--gray-1)] p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
            <LuTriangleAlert className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--gray-12)]">
              Restore this version?
            </p>
            <p className="mt-1 text-[12px] text-[var(--gray-10)] leading-relaxed">
              Restoring{' '}
              <span className="font-medium text-[var(--gray-12)]">&ldquo;{versionLabel}&rdquo;</span>{' '}
              will overwrite your current flow. This action cannot be undone — save
              a version first if you want to keep your current state.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-zoru-ink px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-zoru-ink active:bg-zoru-ink transition-colors"
          >
            <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            Yes, restore
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── VersionHistoryPanel ────────────────────────────────────────────────────── */

export function VersionHistoryPanel({ flowId, onClose, onRestore }: Props) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Save-current-version UI state
  const [labelDraft, setLabelDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Restore state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Compare-two-versions mode: when active, clicking a row toggles selection
  // instead of restoring.  Once two versions are picked the user can fire the
  // existing diff page with both ids.
  const [compareMode, setCompareMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const togglePicked = useCallback((id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setPicked([]);
  }, []);

  const openDiff = useCallback(() => {
    if (picked.length !== 2) return;
    // The diff page expects `from` (older) and `to` (newer).  Versions are
    // returned newest-first, so the lower-index pick is the newer one.
    const [a, b] = picked;
    const orderA = versions.findIndex((v) => v._id === a);
    const orderB = versions.findIndex((v) => v._id === b);
    const from = orderA > orderB ? a : b;
    const to = orderA > orderB ? b : a;
    router.push(
      `/dashboard/sabflow/flow-builder/${flowId}/diff?from=${from}&to=${to}`,
    );
  }, [picked, versions, flowId, router]);

  /* ── Fetch versions ───────────────────────────────────────── */

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/sabflow/${flowId}/versions`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load versions');
      }
      const data = (await res.json()) as { versions: VersionSummary[] };
      setVersions(data.versions);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  /* ── Save current version ─────────────────────────────────── */

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/sabflow/${flowId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: labelDraft.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to save version');
      }
      setLabelDraft('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // Refresh list
      await fetchVersions();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save version');
    } finally {
      setIsSaving(false);
    }
  }, [flowId, labelDraft, fetchVersions]);

  /* ── Restore ──────────────────────────────────────────────── */

  const handleRestoreConfirmed = useCallback(async () => {
    if (!confirmingId) return;
    const versionId = confirmingId;
    setConfirmingId(null);
    setRestoringId(versionId);
    setRestoreError(null);
    try {
      const res = await fetch(
        `/api/sabflow/${flowId}/versions/${versionId}/restore`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to restore version');
      }
      const data = (await res.json()) as { flow: SabFlowDoc & { _id: string } };
      onRestore(data.flow);
      onClose();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoringId(null);
    }
  }, [confirmingId, flowId, onRestore, onClose]);

  /* ── Render ───────────────────────────────────────────────── */

  const confirmingVersion = confirmingId
    ? versions.find((v) => v._id === confirmingId)
    : null;

  return (
    <>
      {/* Confirmation dialog (portal-like, rendered above everything) */}
      {confirmingVersion && (
        <ConfirmDialog
          versionLabel={confirmingVersion.label}
          onConfirm={handleRestoreConfirmed}
          onCancel={() => setConfirmingId(null)}
        />
      )}

      <div className="w-[320px] shrink-0 border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden flex flex-col">

        {/* ── Panel header ─────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--gray-4)] shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted shrink-0">
            <LuHistory className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">
            Version History
          </span>
          {!isLoading && (
            <span className="text-[11px] tabular-nums text-[var(--gray-9)] font-medium">
              {versions.length} / 20
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close version history"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* ── Save current version ──────────────────────────────── */}
        <div className="px-3 py-3 border-b border-[var(--gray-4)] shrink-0 space-y-2">
          <p className="text-[11px] font-medium text-[var(--gray-9)] uppercase tracking-wide px-0.5">
            Save current state
          </p>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <LuTag className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--gray-8)] pointer-events-none" strokeWidth={2} />
              <input
                ref={labelInputRef}
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
                placeholder="Label (optional)"
                maxLength={60}
                className={cn(
                  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
                  'pl-7 pr-2.5 py-1.5 text-[12px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)]',
                  'outline-none focus:border-zoru-line focus:ring-1 focus:ring-zoru-line/20 transition-colors',
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              title="Save version"
              aria-label="Save current version"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                isSaving
                  ? 'bg-[var(--gray-4)] text-[var(--gray-8)] cursor-wait'
                  : saveSuccess
                    ? 'bg-zoru-ink text-white'
                    : 'bg-zoru-ink text-white hover:bg-zoru-ink active:bg-zoru-ink',
              )}
            >
              {isSaving
                ? <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                : saveSuccess
                  ? <LuCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                  : <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
              }
            </button>
          </div>
          {saveError && (
            <p className="text-[11px] text-zoru-ink truncate" title={saveError}>{saveError}</p>
          )}
        </div>

        {/* ── Compare-mode toolbar ──────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-[var(--gray-4)] px-3 py-2 shrink-0">
          <button
            type="button"
            onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] font-medium transition-colors',
              compareMode
                ? 'border-zoru-line bg-zoru-ink/10 text-zoru-ink'
                : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-10)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
            )}
            title={compareMode ? 'Exit compare mode' : 'Pick two versions to diff'}
          >
            <LuGitCompare className="h-3 w-3" strokeWidth={2} />
            {compareMode ? 'Cancel' : 'Compare versions'}
          </button>
          {compareMode && (
            <>
              <span className="text-[10.5px] text-[var(--gray-9)] ml-auto">
                {picked.length} / 2 picked
              </span>
              <button
                type="button"
                onClick={openDiff}
                disabled={picked.length !== 2}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11.5px] font-semibold transition-colors',
                  picked.length === 2
                    ? 'bg-zoru-ink text-white hover:bg-zoru-ink'
                    : 'bg-[var(--gray-3)] text-[var(--gray-8)] cursor-not-allowed',
                )}
              >
                View diff
              </button>
            </>
          )}
        </div>

        {/* ── Restore error banner ──────────────────────────────── */}
        {restoreError && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 dark:border-zoru-line dark:bg-zoru-ink/30 shrink-0">
            <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 text-zoru-ink" strokeWidth={2} />
            <p className="text-[11.5px] text-zoru-ink dark:text-zoru-ink-muted flex-1 min-w-0 truncate">{restoreError}</p>
            <button
              type="button"
              onClick={() => setRestoreError(null)}
              className="text-zoru-ink-muted hover:text-zoru-ink transition-colors"
            >
              <LuX className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── Version list ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LuLoader className="h-5 w-5 animate-spin text-[var(--gray-8)]" strokeWidth={2} />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/30">
                <LuTriangleAlert className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[12.5px] font-medium text-[var(--gray-11)]">Could not load versions</p>
                <p className="text-[11.5px] text-[var(--gray-9)] mt-0.5">{fetchError}</p>
              </div>
              <button
                type="button"
                onClick={() => void fetchVersions()}
                className="rounded-lg border border-[var(--gray-5)] px-3 py-1.5 text-[12px] text-[var(--gray-10)] hover:bg-[var(--gray-3)] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
                <LuHistory className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[12.5px] font-medium text-[var(--gray-11)]">No versions yet</p>
                <p className="text-[11.5px] text-[var(--gray-9)] mt-0.5">
                  Save your first version to start tracking history.
                </p>
              </div>
            </div>
          ) : (
            versions.map((version, idx) => (
              <VersionRow
                key={version._id}
                version={version}
                isLatest={idx === 0}
                isRestoring={restoringId === version._id}
                onRestore={() => setConfirmingId(version._id)}
                onCompare={() =>
                  router.push(
                    `/dashboard/sabflow/flow-builder/${flowId}/diff?from=${version._id}&to=current`,
                  )
                }
                compareMode={compareMode}
                isPicked={picked.includes(version._id)}
                onTogglePick={() => togglePicked(version._id)}
              />
            ))
          )}
        </div>

        {/* ── Footer hint ───────────────────────────────────────── */}
        {versions.length > 0 && (
          <div className="px-4 py-2.5 border-t border-[var(--gray-4)] shrink-0">
            <p className="text-[11px] text-[var(--gray-9)]">
              Up to 20 versions are kept. Oldest are removed automatically.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/* ── VersionRow ─────────────────────────────────────────────────────────────── */

interface VersionRowProps {
  version: VersionSummary;
  isLatest: boolean;
  isRestoring: boolean;
  onRestore: () => void;
  onCompare: () => void;
  /** When true the whole row becomes a selectable checkbox for diffing. */
  compareMode?: boolean;
  /** True when this row is one of the two picked in compare mode. */
  isPicked?: boolean;
  /** Called when the row is clicked while in compare mode. */
  onTogglePick?: () => void;
}

function VersionRow({
  version,
  isLatest,
  isRestoring,
  onRestore,
  onCompare,
  compareMode = false,
  isPicked = false,
  onTogglePick,
}: VersionRowProps) {
  return (
    <div
      onClick={compareMode ? onTogglePick : undefined}
      role={compareMode ? 'checkbox' : undefined}
      aria-checked={compareMode ? isPicked : undefined}
      tabIndex={compareMode ? 0 : undefined}
      onKeyDown={
        compareMode
          ? (e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onTogglePick?.();
              }
            }
          : undefined
      }
      className={cn(
        'group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
        compareMode && 'cursor-pointer',
        isPicked
          ? 'border-zoru-line bg-zoru-ink/10'
          : isLatest
          ? 'border-zoru-line bg-zoru-surface-2/60 dark:border-zoru-line/50 dark:bg-zoru-ink/20'
          : 'border-[var(--gray-5)] bg-[var(--gray-2)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-1)]',
      )}
    >
      {compareMode && (
        <input
          type="checkbox"
          checked={isPicked}
          onChange={() => onTogglePick?.()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select "${version.label}" for comparison`}
          className="mt-1 h-3.5 w-3.5 shrink-0 accent-zoru-ink cursor-pointer"
        />
      )}
      {/* Clock icon */}
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5',
        isLatest
          ? 'bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted'
          : 'bg-[var(--gray-3)] text-[var(--gray-8)]',
      )}>
        <LuClock className="h-3 w-3" strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-[12.5px] font-medium text-[var(--gray-12)]">
            {version.label}
          </p>
          {isLatest && (
            <span className="shrink-0 rounded-md bg-zoru-surface-2 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
              Latest
            </span>
          )}
        </div>
        <p
          className="text-[11px] text-[var(--gray-9)] mt-0.5"
          title={formatDate(version.savedAt)}
        >
          {relativeTime(version.savedAt)}
        </p>
      </div>

      {/* Action buttons — hidden in compare mode so clicks don't trigger restore. */}
      <div
        className={cn(
          'flex items-center gap-0.5 mt-0.5',
          compareMode && 'hidden',
        )}
      >
        {/* Compare with current */}
        <button
          type="button"
          onClick={onCompare}
          disabled={isLatest}
          title={isLatest ? 'This is the latest saved version' : 'Compare with current'}
          aria-label={`Compare version "${version.label}" with current`}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
            isLatest
              ? 'text-[var(--gray-7)] cursor-not-allowed opacity-40'
              : 'text-[var(--gray-8)] opacity-0 group-hover:opacity-100 hover:bg-zoru-surface-2 hover:text-zoru-ink dark:hover:bg-zoru-ink/30 dark:hover:text-zoru-ink-muted',
          )}
        >
          <LuGitCompare className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        {/* Restore */}
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoring}
          title="Restore this version"
          aria-label={`Restore version "${version.label}"`}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
            isRestoring
              ? 'text-[var(--gray-8)] cursor-wait'
              : 'text-[var(--gray-8)] opacity-0 group-hover:opacity-100 hover:bg-zoru-surface-2 hover:text-zoru-ink dark:hover:bg-zoru-ink/30 dark:hover:text-zoru-ink-muted',
          )}
        >
          {isRestoring
            ? <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            : <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          }
        </button>
      </div>
    </div>
  );
}
