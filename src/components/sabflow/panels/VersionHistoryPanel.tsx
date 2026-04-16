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
import {
  LuHistory,
  LuRotateCcw,
  LuX,
  LuPlus,
  LuCheck,
  LuLoader,
  LuAlertTriangle,
  LuClock,
  LuTag,
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
            <LuAlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />
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
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-amber-600 active:bg-amber-700 transition-colors"
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
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400 shrink-0">
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
                  'outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 transition-colors',
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
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700',
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
            <p className="text-[11px] text-red-500 truncate" title={saveError}>{saveError}</p>
          )}
        </div>

        {/* ── Restore error banner ──────────────────────────────── */}
        {restoreError && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30 shrink-0">
            <LuAlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" strokeWidth={2} />
            <p className="text-[11.5px] text-red-600 dark:text-red-400 flex-1 min-w-0 truncate">{restoreError}</p>
            <button
              type="button"
              onClick={() => setRestoreError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30">
                <LuAlertTriangle className="h-5 w-5" strokeWidth={1.5} />
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
}

function VersionRow({ version, isLatest, isRestoring, onRestore }: VersionRowProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all',
        isLatest
          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20'
          : 'border-[var(--gray-5)] bg-[var(--gray-2)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-1)]',
      )}
    >
      {/* Clock icon */}
      <div className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5',
        isLatest
          ? 'bg-amber-100 text-amber-500 dark:bg-amber-900/40 dark:text-amber-400'
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
            <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
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

      {/* Restore button */}
      <button
        type="button"
        onClick={onRestore}
        disabled={isRestoring}
        title="Restore this version"
        aria-label={`Restore version "${version.label}"`}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors mt-0.5',
          isRestoring
            ? 'text-[var(--gray-8)] cursor-wait'
            : 'text-[var(--gray-8)] opacity-0 group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400',
        )}
      >
        {isRestoring
          ? <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          : <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
        }
      </button>
    </div>
  );
}
