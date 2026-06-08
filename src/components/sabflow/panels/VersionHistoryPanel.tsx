'use client';

/**
 * VersionHistoryPanel
 *
 * Sliding right-side panel that lists saved versions of a SabFlow and
 * allows the user to restore any previous snapshot.
 *
 * Pure 20ui design system. Icons: lucide-react.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  RotateCcw,
  X,
  Plus,
  Check,
  Clock,
  Tag,
  GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  Button,
  IconButton,
  Badge,
  Checkbox,
  Field,
  Input,
  Alert,
  EmptyState,
  Spinner,
  useToast,
} from '@/components/sabcrm/20ui';
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

/* ── VersionHistoryPanel ────────────────────────────────────────────────────── */

export function VersionHistoryPanel({ flowId, onClose, onRestore }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Save-current-version UI state
  const [labelDraft, setLabelDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Restore state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Compare-two-versions mode: when active, clicking a row toggles selection
  // instead of restoring. Once two versions are picked the user can fire the
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
    // The diff page expects `from` (older) and `to` (newer). Versions are
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
      toast.success('Version saved');
      setTimeout(() => setSaveSuccess(false), 2000);
      // Refresh list
      await fetchVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save version');
    } finally {
      setIsSaving(false);
    }
  }, [flowId, labelDraft, fetchVersions, toast]);

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
      {/* Confirmation dialog (Radix-portalled, with focus trap + escape). */}
      <AlertDialog
        open={Boolean(confirmingVersion)}
        onOpenChange={(next) => {
          if (!next) setConfirmingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Restoring{' '}
              <span className="font-medium text-[var(--st-text)]">
                &ldquo;{confirmingVersion?.label}&rdquo;
              </span>{' '}
              will overwrite your current flow. This action cannot be undone, save
              a version first if you want to keep your current state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction intent="primary" onClick={handleRestoreConfirmed}>
              Yes, restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="20ui w-[320px] shrink-0 border-l border-[var(--st-border)] bg-[var(--st-bg)] z-20 overflow-hidden flex flex-col">

        {/* ── Panel header ─────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--st-border)] shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)] shrink-0">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">
            Version History
          </span>
          {!isLoading && (
            <span className="text-[11px] tabular-nums text-[var(--st-text-tertiary)] font-medium">
              {versions.length} / 20
            </span>
          )}
          <IconButton
            label="Close version history"
            icon={X}
            size="sm"
            onClick={onClose}
          />
        </div>

        {/* ── Save current version ──────────────────────────────── */}
        <div className="px-3 py-3 border-b border-[var(--st-border)] shrink-0 space-y-2">
          <p className="text-[11px] font-medium text-[var(--st-text-tertiary)] uppercase tracking-wide px-0.5">
            Save current state
          </p>
          <div className="flex items-end gap-1.5">
            <div className="flex-1 min-w-0">
              <Field label="Version label">
                <Input
                  inputSize="sm"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave();
                  }}
                  placeholder="Label (optional)"
                  maxLength={60}
                  iconLeft={Tag}
                />
              </Field>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              loading={isSaving}
              iconLeft={saveSuccess ? Check : Plus}
              aria-label="Save current version"
            >
              {saveSuccess ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        {/* ── Compare-mode toolbar ──────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-3 py-2 shrink-0">
          <Button
            variant={compareMode ? 'primary' : 'secondary'}
            size="sm"
            iconLeft={GitCompare}
            onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
            title={compareMode ? 'Exit compare mode' : 'Pick two versions to diff'}
          >
            {compareMode ? 'Cancel' : 'Compare versions'}
          </Button>
          {compareMode && (
            <>
              <span className="text-[10.5px] text-[var(--st-text-tertiary)] ml-auto">
                {picked.length} / 2 picked
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={openDiff}
                disabled={picked.length !== 2}
              >
                View diff
              </Button>
            </>
          )}
        </div>

        {/* ── Restore error banner ──────────────────────────────── */}
        {restoreError && (
          <div className="mx-3 mt-2 shrink-0">
            <Alert
              tone="danger"
              onClose={() => setRestoreError(null)}
              closeLabel="Dismiss restore error"
            >
              {restoreError}
            </Alert>
          </div>
        )}

        {/* ── Version list ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" label="Loading versions" />
            </div>
          ) : fetchError ? (
            <EmptyState
              icon={Clock}
              tone="danger"
              size="sm"
              title="Could not load versions"
              description={fetchError}
              action={
                <Button variant="secondary" size="sm" onClick={() => void fetchVersions()}>
                  Retry
                </Button>
              }
            />
          ) : versions.length === 0 ? (
            <EmptyState
              icon={History}
              size="sm"
              title="No versions yet"
              description="Save your first version to start tracking history."
            />
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
          <div className="px-4 py-2.5 border-t border-[var(--st-border)] shrink-0">
            <p className="text-[11px] text-[var(--st-text-tertiary)]">
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
        'group flex items-start gap-2.5 rounded-[var(--st-radius-lg)] border px-3 py-2.5 transition-all',
        compareMode && 'cursor-pointer',
        isPicked
          ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
          : isLatest
            ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]/60'
            : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg)]',
      )}
    >
      {compareMode && (
        <span className="mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            size="sm"
            checked={isPicked}
            onChange={() => onTogglePick?.()}
            aria-label={`Select "${version.label}" for comparison`}
          />
        </span>
      )}
      {/* Clock icon */}
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius)] mt-0.5',
          isLatest
            ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
            : 'bg-[var(--st-bg-muted)] text-[var(--st-text-tertiary)]',
        )}
      >
        <Clock className="h-3 w-3" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-[12.5px] font-medium text-[var(--st-text)]">
            {version.label}
          </p>
          {isLatest && (
            <Badge tone="accent" className="shrink-0">
              Latest
            </Badge>
          )}
        </div>
        <p
          className="text-[11px] text-[var(--st-text-tertiary)] mt-0.5"
          title={formatDate(version.savedAt)}
        >
          {relativeTime(version.savedAt)}
        </p>
      </div>

      {/* Action buttons, hidden in compare mode so clicks do not trigger restore. */}
      <div
        className={cn(
          'flex items-center gap-0.5 mt-0.5',
          compareMode
            ? 'hidden'
            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
        )}
      >
        {/* Compare with current */}
        <IconButton
          label={
            isLatest
              ? 'This is the latest saved version'
              : `Compare version "${version.label}" with current`
          }
          icon={GitCompare}
          size="sm"
          onClick={onCompare}
          disabled={isLatest}
        />

        {/* Restore */}
        <IconButton
          label={`Restore version "${version.label}"`}
          icon={RotateCcw}
          size="sm"
          onClick={onRestore}
          disabled={isRestoring}
        />
      </div>
    </div>
  );
}
