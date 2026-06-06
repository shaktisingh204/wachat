'use client';

/**
 * ApiKeysClient
 *
 * Manage SabFlow API keys.  Lists existing keys (prefix · label · created ·
 * last used) with per-row revoke, and provides a "Create API key" flow that
 * mints a key and shows the raw value exactly once with a copy-to-clipboard
 * affordance and a strong warning.  Reads/writes via:
 *
 *   GET    /api/sabflow/api-keys             → { keys: ApiKey[] }
 *   POST   /api/sabflow/api-keys   { label } → { id, rawKey, prefix }
 *   DELETE /api/sabflow/api-keys/[keyId]
 *
 * Visual language mirrors `executions-list-client.tsx`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  LuCheck,
  LuCopy,
  LuKey,
  LuLoader,
  LuPlus,
  LuRefreshCw,
  LuShieldAlert,
  LuTrash2,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

type ApiKeyRow = {
  _id: string;
  prefix: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  requestCount?: number;
  lastEndpoint?: string;
  lastStatus?: number;
};

type MintedKey = {
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
};

export function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createLabel, setCreateLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Raw-key reveal modal state
  const [minted, setMinted] = useState<MintedKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state — id currently in-flight, prevents double-clicks.
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sabflow/api-keys', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load keys (${res.status})`);
      const json = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(json.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(() => {
    setCreateLabel('');
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
  }, [creating]);

  const handleCreate = useCallback(async () => {
    const label = createLabel.trim();
    if (!label) {
      setCreateError('Please enter a label so you can identify this key later.');
      return;
    }
    if (label.length > 80) {
      setCreateError('Label too long (max 80 chars).');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/sabflow/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        rawKey?: string;
        prefix?: string;
        error?: string;
      };
      if (!res.ok || !json.rawKey || !json.id || !json.prefix) {
        throw new Error(json.error || `Failed to create key (${res.status})`);
      }
      setMinted({
        id: json.id,
        rawKey: json.rawKey,
        prefix: json.prefix,
        label,
      });
      setCreateOpen(false);
      setCreateLabel('');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }, [createLabel]);

  const handleCopy = useCallback(async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.rawKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can fail on insecure contexts — fall through silently;
      // user can still select + copy manually.
    }
  }, [minted]);

  const dismissMinted = useCallback(() => {
    setMinted(null);
    setCopied(false);
    void load();
  }, [load]);

  const handleRevoke = useCallback(
    async (row: ApiKeyRow) => {
      const confirmed = window.confirm(
        `Revoke key ${row.prefix} (“${row.label}”)? This cannot be undone — any code using this key will stop working immediately.`,
      );
      if (!confirmed) return;
      setRevokingId(row._id);
      try {
        const res = await fetch(`/api/sabflow/api-keys/${row._id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `Failed to revoke (${res.status})`);
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to revoke key');
      } finally {
        setRevokingId(null);
      }
    },
    [load],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--gray-4)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuKey className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            API keys
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Personal tokens for the SabFlow API — keep them secret.
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
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)]"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Create API key
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && keys.length === 0 ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading keys…</span>
          </div>
        ) : error ? (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-[12px] text-[var(--st-text)]">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuKey className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-[var(--gray-11)] font-medium">
                No API keys yet
              </p>
              <p className="text-[11.5px] text-[var(--gray-9)]">
                Create a key to authenticate calls to the SabFlow API.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)]"
            >
              <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Create your first key
            </button>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="border-b border-[var(--gray-4)] text-left">
              <tr className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)]">
                <th className="hidden sm:table-cell px-4 sm:px-6 py-2 font-semibold">Prefix</th>
                <th className="px-4 sm:px-3 py-2 font-semibold">Label</th>
                <th className="hidden md:table-cell px-3 py-2 font-semibold">Created</th>
                <th className="hidden sm:table-cell px-3 py-2 font-semibold">Last used</th>
                <th className="hidden lg:table-cell px-3 py-2 font-semibold">Requests</th>
                <th className="hidden lg:table-cell px-3 py-2 font-semibold">Last endpoint</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((row) => (
                <tr
                  key={row._id}
                  className="border-b border-[var(--gray-3)] hover:bg-[var(--gray-2)]"
                >
                  <td className="hidden sm:table-cell px-4 sm:px-6 py-2.5">
                    <code className="rounded-md bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--gray-12)]">
                      {row.prefix}…
                    </code>
                  </td>
                  <td className="px-4 sm:px-3 py-2.5">
                    <span className="font-medium text-[var(--gray-12)]">
                      {row.label || '—'}
                    </span>
                    <code className="ml-2 sm:hidden rounded-md bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--gray-11)]">
                      {row.prefix}…
                    </code>
                  </td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-[var(--gray-10)]">
                    {formatTime(row.createdAt)}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-2.5 text-[var(--gray-10)]">
                    {row.lastUsedAt ? formatTime(row.lastUsedAt) : 'Never'}
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2.5 tabular-nums text-[var(--gray-11)]">
                    {(row.requestCount ?? 0).toLocaleString()}
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2.5 text-[var(--gray-10)]">
                    {row.lastEndpoint ? (
                      <code
                        title={row.lastEndpoint}
                        className="rounded-md bg-[var(--gray-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--gray-11)]"
                      >
                        {truncate(row.lastEndpoint, 32)}
                      </code>
                    ) : (
                      <span className="text-[var(--gray-9)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRevoke(row)}
                      disabled={revokingId === row._id}
                      className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11.5px] font-medium text-[var(--st-text)] hover:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] disabled:opacity-50 dark:hover:bg-[var(--st-text)]/40"
                    >
                      {revokingId === row._id ? (
                        <LuLoader className="h-3 w-3 animate-spin" />
                      ) : (
                        <LuTrash2 className="h-3 w-3" />
                      )}
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <ModalShell
          onClose={closeCreate}
          title="Create API key"
          subtitle="Generate a personal token for the SabFlow API."
          icon={<LuKey className="h-4 w-4" strokeWidth={2} />}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="api-key-label"
                className="text-[11.5px] font-medium text-[var(--gray-11)]"
              >
                Label
              </label>
              <input
                id="api-key-label"
                type="text"
                autoFocus
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder="e.g. Production backend"
                maxLength={80}
                disabled={creating}
                className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-2 text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)] disabled:opacity-50"
              />
              <p className="text-[10.5px] text-[var(--gray-9)]">
                Used to identify the key in this list. Max 80 characters.
              </p>
            </div>

            {createError && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)]">
                <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{createError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeCreate}
                disabled={creating}
                className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !createLabel.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)] disabled:opacity-50"
              >
                {creating ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
                {creating ? 'Creating…' : 'Create key'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Raw key reveal modal — shown exactly once */}
      {minted && (
        <ModalShell
          onClose={dismissMinted}
          title="Save your API key"
          subtitle={`Created “${minted.label}”.`}
          icon={<LuShieldAlert className="h-4 w-4" strokeWidth={2} />}
          iconClassName="bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5 text-[11.5px] text-[var(--st-text)] dark:border-[var(--st-border)]/60 dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
              <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  This key will not be shown again.
                </span>
                <span>
                  Copy it now and store it somewhere safe. If you lose it,
                  you&rsquo;ll need to revoke it and create a new one.
                </span>
              </div>
            </div>

            <div className="flex items-stretch overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]">
              <code className="flex-1 truncate px-3 py-2 font-mono text-[12px] text-[var(--gray-12)]">
                {minted.rawKey}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'flex items-center gap-1.5 border-l border-[var(--gray-5)] px-3 py-2 text-[11.5px] font-medium transition-colors',
                  copied
                    ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]'
                    : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
                )}
                aria-label="Copy API key"
              >
                {copied ? (
                  <>
                    <LuCheck className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <LuCopy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={dismissMinted}
                className="rounded-lg bg-[var(--st-text)] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[var(--st-text)]"
              >
                I&rsquo;ve saved it
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── helpers */

type ModalShellProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
};

function ModalShell({
  title,
  subtitle,
  icon,
  iconClassName,
  onClose,
  children,
}: ModalShellProps) {
  // Close on Escape — top-level effect so it follows hook ordering rules.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[var(--gray-4)] px-5 py-4">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              iconClassName ??
                'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]',
            )}
          >
            {icon}
          </div>
          <div className="flex flex-col leading-tight">
            <h2 className="text-[14px] font-semibold text-[var(--gray-12)]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11.5px] text-[var(--gray-9)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto -mr-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  // Keep the tail of the path — it's usually the most identifying part
  // (e.g. ".../flows/abc123/run").
  return `…${s.slice(-(max - 1))}`;
}

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
