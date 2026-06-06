'use client';

/**
 * FoldersClient
 *
 * Manages SabFlow folder records — list, create, rename, delete.  The
 * underlying REST endpoints under `/api/sabflow/folders` cascade renames
 * onto every flow assigned to the folder, and unset `folderId` on
 * deletion (flows themselves are never removed).
 *
 * Folder counts are best-effort: if a `flows-by-folder` endpoint isn't
 * available we just show the folder card without a count.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  LuFolder,
  LuFolderPlus,
  LuLoader,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuTrash2,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type FolderRow = {
  _id: string;
  name: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#71717a', label: 'Zinc' },
];

export function FoldersClient() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [deleting, setDeleting] = useState<FolderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/folders', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load folders (${res.status})`);
      }
      const json = (await res.json()) as { folders: FolderRow[] };
      const rows = json.folders ?? [];
      setFolders(rows);

      // Best-effort fetch of folder counts.  If the endpoint isn't wired
      // up we silently skip the count column.
      try {
        const entries = await Promise.all(
          rows.map(async (folder) => {
            const r = await fetch(
              `/api/sabflow/flows-by-folder?folder=${encodeURIComponent(folder.name)}`,
              { cache: 'no-store' },
            );
            if (!r.ok) return [folder._id, null] as const;
            const payload = (await r.json().catch(() => null)) as
              | { count?: number; flows?: unknown[] }
              | null;
            const count =
              typeof payload?.count === 'number'
                ? payload.count
                : Array.isArray(payload?.flows)
                  ? payload.flows.length
                  : null;
            return [folder._id, count] as const;
          }),
        );
        const next: Record<string, number> = {};
        for (const [id, count] of entries) {
          if (typeof count === 'number') next[id] = count;
        }
        setCounts(next);
      } catch {
        setCounts({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (name: string, color?: string) => {
      const res = await fetch('/api/sabflow/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setCreateOpen(false);
      await load();
    },
    [load],
  );

  const handleRename = useCallback(
    async (folderId: string, name: string, color?: string) => {
      const res = await fetch(`/api/sabflow/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setEditing(null);
      await load();
    },
    [load],
  );

  const handleDelete = useCallback(
    async (folderId: string) => {
      const res = await fetch(`/api/sabflow/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `Failed (${res.status})`);
      }
      setDeleting(null);
      await load();
    },
    [load],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuFolder className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Folders
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Organise your flows into colour-coded groups
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--st-text)]"
          >
            <LuPlus className="h-3.5 w-3.5" />
            Create folder
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-[12px] text-[var(--st-text)]">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && folders.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading folders…</span>
          </div>
        ) : folders.length === 0 && !error ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuFolderPlus className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-[var(--gray-12)]">
              No folders yet
            </p>
            <p className="max-w-sm text-[12px] text-[var(--gray-9)]">
              Create a folder to group related flows together. Flows can be
              moved in and out at any time.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--st-text)]"
            >
              <LuPlus className="h-3.5 w-3.5" />
              Create your first folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                count={counts[folder._id]}
                onEdit={() => setEditing(folder)}
                onDelete={() => setDeleting(folder)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {createOpen && (
        <FolderModal
          title="Create folder"
          submitLabel="Create"
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {editing && (
        <FolderModal
          title="Rename folder"
          submitLabel="Save"
          initialName={editing.name}
          initialColor={editing.color}
          onSubmit={async (name, color) => {
            await handleRename(editing._id, name, color);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          folder={deleting}
          onConfirm={() => handleDelete(deleting._id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/* ── Folder card ────────────────────────────────────────────── */

function FolderCard({
  folder,
  count,
  onEdit,
  onDelete,
}: {
  folder: FolderRow;
  count: number | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swatch = folder.color ?? '#71717a';
  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] p-4 hover:border-[var(--gray-7)] hover:bg-[var(--gray-2)]">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${swatch}1f`, color: swatch }}
        >
          <LuFolder className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13.5px] font-semibold text-[var(--gray-12)]"
            title={folder.name}
          >
            {folder.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--gray-9)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: swatch }}
            />
            {typeof count === 'number' ? (
              <span className="tabular-nums">
                {count} {count === 1 ? 'flow' : 'flows'}
              </span>
            ) : (
              <span>Folder</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10.5px] text-[var(--gray-9)]">
        <span>
          Created{' '}
          {folder.createdAt ? formatDate(folder.createdAt) : '—'}
        </span>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Rename"
            className="rounded-md p-1 text-[var(--gray-10)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
          >
            <LuPencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="rounded-md p-1 text-[var(--gray-10)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:hover:bg-[var(--st-text)]/40 dark:hover:text-[var(--st-text-secondary)]"
          >
            <LuTrash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create / edit modal ────────────────────────────────────── */

function FolderModal({
  title,
  submitLabel,
  initialName,
  initialColor,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialColor?: string;
  onSubmit: (name: string, color?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [color, setColor] = useState<string | undefined>(
    initialColor ?? PALETTE[0]?.value,
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(name.trim(), color);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--gray-4)] px-5 py-3">
          <h2 className="text-[14px] font-semibold text-[var(--gray-12)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="folder-name"
              className="text-[11.5px] font-medium text-[var(--gray-11)]"
            >
              Name
            </label>
            <input
              id="folder-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer onboarding"
              maxLength={60}
              className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-[var(--gray-11)]">
              Colour
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((c) => {
                const selected = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={cn(
                      'h-7 w-7 rounded-full ring-offset-2 ring-offset-[var(--gray-1)] transition-all',
                      selected
                        ? 'ring-2 ring-[var(--gray-12)] scale-110'
                        : 'ring-1 ring-[var(--gray-5)] hover:scale-105',
                    )}
                    style={{ backgroundColor: c.value }}
                    aria-label={c.label}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)]">
              <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--st-text)] disabled:opacity-50"
          >
            {submitting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Delete confirmation ────────────────────────────────────── */

function DeleteConfirmModal({
  folder,
  onConfirm,
  onClose,
}: {
  folder: FolderRow;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setErr(null);
    try {
      await onConfirm();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--gray-4)] px-5 py-3">
          <h2 className="text-[14px] font-semibold text-[var(--gray-12)]">
            Delete folder
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-[13px] text-[var(--gray-12)]">
            Delete{' '}
            <span className="font-semibold">&ldquo;{folder.name}&rdquo;</span>?
          </p>
          <p className="text-[12px] text-[var(--gray-10)]">
            Deleting won&rsquo;t delete flows — they&rsquo;ll move back to the
            workspace root.
          </p>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)]">
              <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--st-text)] disabled:opacity-50"
          >
            {submitting ? (
              <LuLoader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LuTrash2 className="h-3.5 w-3.5" />
            )}
            Delete folder
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
