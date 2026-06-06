'use client';

/**
 * EnvVarsClient
 *
 * CRUD UI for workspace-scoped SabFlow env vars.  Talks to:
 *
 *   GET    /api/sabflow/env-vars
 *   PUT    /api/sabflow/env-vars            { key, value, isSecret? }
 *   DELETE /api/sabflow/env-vars?key=KEY
 *
 * Vars are referenced from flow expressions as `$env.KEY`.  Keys must match
 * `/^[A-Z][A-Z0-9_]*$/` — validated client-side before any network call.
 * Secrets are stored opaquely; the API returns `value: null` for them, and
 * the table masks them as `••••••••`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  LuKey,
  LuLoader,
  LuLock,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuTrash2,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type EnvVarRow = {
  _id: string;
  key: string;
  value: string | null;
  isSecret: boolean;
  updatedAt: string;
};

const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const KEY_HINT =
  'UPPER_SNAKE_CASE: starts with a letter, then letters, digits, or underscores.';

export function EnvVarsClient() {
  const [vars, setVars] = useState<EnvVarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnvVarRow | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<EnvVarRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/env-vars', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to load env vars (${res.status})`);
      }
      const json = (await res.json()) as { vars: EnvVarRow[] };
      setVars(json.vars ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return vars;
    const needle = search.toLowerCase();
    return vars.filter((v) => v.key.toLowerCase().includes(needle));
  }, [vars, search]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row: EnvVarRow) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSaved = useCallback(
    async (saved: EnvVarRow) => {
      // Optimistic merge while we re-fetch in the background.
      setVars((prev) => {
        const idx = prev.findIndex((v) => v.key === saved.key);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved].sort((a, b) => a.key.localeCompare(b.key));
      });
      closeModal();
      void load();
    },
    [closeModal, load],
  );

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sabflow/env-vars?key=${encodeURIComponent(confirmDelete.key)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to delete (${res.status})`);
      }
      setVars((prev) => prev.filter((v) => v.key !== confirmDelete.key));
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuKey className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Environment variables
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Workspace env vars are accessible to every flow as{' '}
            <code className="rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--gray-11)]">
              $env.KEY
            </code>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            <LuRefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)]"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add variable
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gray-4)] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="relative flex items-center w-full sm:w-auto">
          <LuSearch className="absolute left-2.5 h-3.5 w-3.5 text-[var(--gray-8)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key…"
            className="w-full sm:w-[260px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] py-1.5 pl-8 pr-2.5 text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)]"
          />
        </div>
        <span className="text-[10.5px] text-[var(--gray-9)] ml-auto tabular-nums">
          {filtered.length} of {vars.length}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-[12px] text-[var(--st-text)] dark:border-[var(--st-border)]/60 dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[var(--st-text)] hover:opacity-80 dark:text-[var(--st-text-secondary)]"
            aria-label="Dismiss error"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && vars.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading variables…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuKey className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-[var(--gray-11)] font-medium">
              {search
                ? 'No variables match'
                : vars.length === 0
                  ? 'No environment variables yet'
                  : 'No variables match'}
            </p>
            <p className="text-[11.5px] text-[var(--gray-9)] max-w-xs">
              {search
                ? 'Try a different search term.'
                : 'Add a variable to share configuration across all your flows.'}
            </p>
            {!search && vars.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)]"
              >
                <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Add your first variable
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="border-b border-[var(--gray-4)] text-left">
              <tr className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)]">
                <th className="px-4 sm:px-6 py-2 font-semibold">Key</th>
                <th className="px-3 py-2 font-semibold">Value</th>
                <th className="hidden sm:table-cell px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-[var(--gray-3)] hover:bg-[var(--gray-2)]"
                >
                  <td className="px-4 sm:px-6 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      {row.isSecret && (
                        <LuLock
                          className="h-3 w-3 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]"
                          strokeWidth={2.5}
                          aria-label="Secret"
                        />
                      )}
                      <span className="font-mono font-medium text-[var(--gray-12)]">
                        {row.key}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.isSecret ? (
                      <span className="font-mono text-[var(--gray-9)]">
                        {'•'.repeat(8)}
                      </span>
                    ) : (
                      <span
                        className="block max-w-[160px] sm:max-w-[420px] truncate font-mono text-[var(--gray-11)]"
                        title={row.value ?? ''}
                      >
                        {row.value ?? ''}
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-[var(--gray-10)]">
                    {formatTime(row.updatedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
                        aria-label={`Edit ${row.key}`}
                        title="Edit"
                      >
                        <LuPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(row)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-10)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] dark:hover:bg-[var(--st-text)]/40 dark:hover:text-[var(--st-text-secondary)]"
                        aria-label={`Delete ${row.key}`}
                        title="Delete"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <EnvVarModal
          editing={editing}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          envVar={confirmDelete}
          deleting={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── modal: create / edit ─────────────────────────── */

interface EnvVarModalProps {
  editing: EnvVarRow | null;
  onClose: () => void;
  onSaved: (row: EnvVarRow) => void;
}

function EnvVarModal({ editing, onClose, onSaved }: EnvVarModalProps) {
  const isEditing = editing !== null;
  const [key, setKey] = useState(editing?.key ?? '');
  // For secrets when editing we don't know the value — start empty and treat
  // empty submission as "no change".  Non-secret values arrive in full.
  const [value, setValue] = useState(
    editing && !editing.isSecret ? (editing.value ?? '') : '',
  );
  const [isSecret, setIsSecret] = useState(editing?.isSecret ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const keyValid = KEY_RE.test(key);
  const keyError =
    key.length === 0
      ? null
      : !keyValid
        ? KEY_HINT
        : key.length > 64
          ? 'Key too long (max 64 chars)'
          : null;

  const submit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!key.trim()) {
        setFormError('Key is required');
        return;
      }
      if (!keyValid || key.length > 64) {
        setFormError(KEY_HINT);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/sabflow/env-vars', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value, isSecret }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Failed to save (${res.status})`);
        }
        const json = (await res.json()) as { var: EnvVarRow };
        onSaved(json.var);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
    },
    [key, keyValid, value, isSecret, onSaved],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="env-var-modal-title"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="mx-4 w-full max-w-md rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--gray-4)] px-5 py-3">
          <h2
            id="env-var-modal-title"
            className="text-[14px] font-semibold text-[var(--gray-12)]"
          >
            {isEditing ? 'Edit variable' : 'Add variable'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--gray-9)] hover:text-[var(--gray-12)]"
            aria-label="Close"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="env-var-key"
              className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-10)]"
            >
              Key
            </label>
            <input
              id="env-var-key"
              type="text"
              autoFocus={!isEditing}
              disabled={isEditing}
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="MY_API_KEY"
              className={cn(
                'rounded-lg border bg-[var(--gray-2)] px-2.5 py-1.5 font-mono text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none disabled:opacity-60',
                keyError
                  ? 'border-[var(--st-border)] focus:border-[var(--st-border)]'
                  : 'border-[var(--gray-5)] focus:border-[var(--st-border)]',
              )}
            />
            <p
              className={cn(
                'text-[11px]',
                keyError ? 'text-[var(--st-text)]' : 'text-[var(--gray-9)]',
              )}
            >
              {keyError ?? KEY_HINT}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="env-var-value"
              className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-10)]"
            >
              Value
              {isEditing && isSecret && (
                <span className="ml-2 normal-case tracking-normal text-[10.5px] font-normal text-[var(--gray-9)]">
                  (leave blank to keep current secret)
                </span>
              )}
            </label>
            <textarea
              id="env-var-value"
              rows={4}
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                isSecret ? 'sk_live_…' : 'https://example.com/webhook'
              }
              className="resize-y rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 font-mono text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)]"
            />
          </div>

          <label
            htmlFor="env-var-secret"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              id="env-var-secret"
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--gray-6)] accent-[var(--st-text)]"
            />
            <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--gray-11)]">
              <LuLock className="h-3 w-3" />
              Treat as secret (value hidden in the UI)
            </span>
          </label>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)] dark:border-[var(--st-border)]/60 dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
              <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--gray-4)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !keyValid}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)] disabled:opacity-50"
          >
            {submitting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            {isEditing ? 'Save changes' : 'Add variable'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────── modal: delete confirm ─────────────────────────── */

interface DeleteConfirmModalProps {
  envVar: EnvVarRow;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({
  envVar,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="env-var-delete-title"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-sm rounded-xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-2xl"
      >
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
            <LuTriangleAlert className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1">
            <h2
              id="env-var-delete-title"
              className="text-[14px] font-semibold text-[var(--gray-12)]"
            >
              Delete variable?
            </h2>
            <p className="text-[12px] text-[var(--gray-10)]">
              Flows referencing{' '}
              <code className="rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[11px] text-[var(--gray-11)]">
                $env.{envVar.key}
              </code>{' '}
              will get an empty string at runtime. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--gray-4)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)] disabled:opacity-50"
          >
            {deleting && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
