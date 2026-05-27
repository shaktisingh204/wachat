'use client';

/**
 * ScopesClient
 *
 * UI for managing a single OAuth credential's granted scopes.
 *
 *   - GET  /api/sabflow/credentials/[id]/scopes
 *       → provider, granted (with required flag + description), catalog,
 *         locally-revoked scope list.
 *   - DELETE /api/sabflow/credentials/[id]/scopes/[scope]
 *       → soft-revoke a single scope (provider revoke endpoint when
 *         available, otherwise local-only).
 *   - POST  /api/sabflow/credentials/[id]/scopes
 *       → request additional scopes (kicks off OAuth re-consent flow).
 *
 * Required scopes (provider-minimum) cannot be revoked individually; the
 * row's Revoke button is disabled with an explanatory tooltip.  To kill the
 * whole credential, use the destructive section at the bottom.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LuArrowRight,
  LuLoader,
  LuLock,
  LuRefreshCw,
  LuShieldCheck,
  LuTrash2,
  LuTriangleAlert,
  LuPlus,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types (mirror the API response shape) ─────────────────────────────── */

type GrantedScope = {
  scope: string;
  description: string;
  required: boolean;
  revoked: boolean;
};

type ScopeCatalogEntry = {
  scope: string;
  description: string;
  required?: boolean;
  category?: string;
};

type ScopesResponse = {
  provider: string | null;
  providerLabel: string | null;
  granted: GrantedScope[];
  revoked: string[];
  required: string[];
  catalog: ScopeCatalogEntry[];
  isOAuth: boolean;
};

/* ── Component ──────────────────────────────────────────────────────────── */

export function ScopesClient({ credentialId }: { credentialId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ScopesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revokingScope, setRevokingScope] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [grantPending, setGrantPending] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const [destructiveRevoking, setDestructiveRevoking] = useState(false);
  const [destructiveError, setDestructiveError] = useState<string | null>(null);

  /* ── Load ─────────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScopeError(null);
    try {
      const res = await fetch(
        `/api/sabflow/credentials/${credentialId}/scopes`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load scopes (${res.status})`);
      }
      const json = (await res.json()) as ScopesResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── Derived ──────────────────────────────────────────────────────────── */

  const grantedScopeSet = useMemo(
    () => new Set((data?.granted ?? []).map((g) => g.scope)),
    [data],
  );

  const additionalCatalog = useMemo(() => {
    if (!data) return [];
    return data.catalog.filter((entry) => !grantedScopeSet.has(entry.scope));
  }, [data, grantedScopeSet]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const revokeOne = useCallback(
    async (scope: string) => {
      if (revokingScope) return;
      const confirmed = window.confirm(
        `Revoke "${scope}"? Any flow that uses this scope will refuse to run with this credential.`,
      );
      if (!confirmed) return;
      setRevokingScope(scope);
      setScopeError(null);
      try {
        const res = await fetch(
          `/api/sabflow/credentials/${credentialId}/scopes/${encodeURIComponent(
            scope,
          )}`,
          { method: 'DELETE' },
        );
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          outcome?: string;
          reason?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `Failed to revoke (${res.status})`);
        }
        await load();
      } catch (e) {
        setScopeError(e instanceof Error ? e.message : 'Failed to revoke');
      } finally {
        setRevokingScope(null);
      }
    },
    [credentialId, load, revokingScope],
  );

  const grantAdditional = useCallback(async () => {
    if (grantPending || picked.size === 0) return;
    setGrantPending(true);
    setGrantError(null);
    try {
      const res = await fetch(
        `/api/sabflow/credentials/${credentialId}/scopes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scopes: Array.from(picked),
            mode: 'append',
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        authorizeUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.authorizeUrl) {
        throw new Error(json.error ?? `Failed to request scopes (${res.status})`);
      }
      // Redirect the browser into the OAuth re-consent flow.  The provider
      // will bounce back to /api/sabflow/oauth/callback which then redirects
      // back to this page.
      window.location.assign(json.authorizeUrl);
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : 'Failed to request scopes');
      setGrantPending(false);
    }
  }, [credentialId, grantPending, picked]);

  const revokeWholeCredential = useCallback(async () => {
    if (destructiveRevoking) return;
    const confirmed = window.confirm(
      'Revoke this credential? Any flow that uses it will stop working.',
    );
    if (!confirmed) return;
    setDestructiveRevoking(true);
    setDestructiveError(null);
    try {
      const res = await fetch(`/api/sabflow/credentials/${credentialId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Failed to revoke (${res.status})`);
      }
      router.push('/dashboard/sabflow/connections');
    } catch (e) {
      setDestructiveError(
        e instanceof Error ? e.message : 'Failed to revoke',
      );
      setDestructiveRevoking(false);
    }
  }, [credentialId, destructiveRevoking, router]);

  const togglePicked = (scope: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--gray-4)] px-6 py-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted">
          <LuShieldCheck className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Credential scopes
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            {data?.providerLabel
              ? `${data.providerLabel} · what this credential is allowed to do`
              : 'Inspect, grant, or revoke OAuth permissions for this credential'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/dashboard/sabflow/connections"
            className="text-[11.5px] font-medium text-[var(--gray-10)] hover:text-[var(--gray-12)]"
          >
            All connections
          </Link>
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
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading credential…</span>
          </div>
        ) : error ? (
          <div className="m-6 flex items-start gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3 text-[12px] text-zoru-ink">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : !data ? null : !data.isOAuth ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuShieldCheck className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-[var(--gray-11)] font-medium">
              No OAuth scopes for this credential
            </p>
            <p className="text-[11.5px] text-[var(--gray-9)] max-w-md">
              This credential uses a raw API key or static secret rather than
              an OAuth grant, so there are no per-scope permissions to inspect.
            </p>
            <Link
              href="/dashboard/sabflow/connections"
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-zoru-ink hover:text-zoru-ink"
            >
              Back to connections <LuArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-6 py-5">
            {/* Provider summary */}
            <div className="flex items-center gap-3 rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-4 py-3">
              <div className="flex flex-col leading-tight">
                <span className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)] font-semibold">
                  Provider
                </span>
                <span className="text-[13px] font-semibold text-[var(--gray-12)]">
                  {data.providerLabel ?? data.provider}
                </span>
              </div>
              <div className="ml-6 flex flex-col leading-tight">
                <span className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)] font-semibold">
                  Granted scopes
                </span>
                <span className="text-[13px] font-semibold text-[var(--gray-12)] tabular-nums">
                  {data.granted.length}
                </span>
              </div>
              {data.revoked.length > 0 && (
                <div className="ml-6 flex flex-col leading-tight">
                  <span className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)] font-semibold">
                    Locally revoked
                  </span>
                  <span className="text-[13px] font-semibold text-zoru-ink tabular-nums">
                    {data.revoked.length}
                  </span>
                </div>
              )}
            </div>

            {/* Granted scopes table */}
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
                Currently granted
              </h2>
              {scopeError && (
                <div className="mb-2 flex items-start gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[11.5px] text-zoru-ink">
                  <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{scopeError}</span>
                </div>
              )}
              <div className="rounded-lg border border-[var(--gray-4)] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="border-b border-[var(--gray-4)] bg-[var(--gray-2)] text-left">
                    <tr className="text-[10.5px] uppercase tracking-wide text-[var(--gray-9)]">
                      <th className="px-4 py-2 font-semibold">Scope</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 font-semibold w-32 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.granted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-6 text-center text-[11.5px] text-[var(--gray-9)]"
                        >
                          No scopes recorded on this credential.
                        </td>
                      </tr>
                    ) : (
                      data.granted.map((row) => (
                        <tr
                          key={row.scope}
                          className="border-b border-[var(--gray-3)] last:border-b-0"
                        >
                          <td className="px-4 py-2.5 font-mono text-[11.5px] text-[var(--gray-12)] align-top">
                            <div className="flex items-center gap-1.5">
                              {row.scope}
                              {row.required && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide bg-zoru-surface-2 text-zoru-ink dark:bg-zoru-ink/40 dark:text-zoru-ink-muted"
                                  title="Required for basic provider functionality"
                                >
                                  <LuLock className="h-2.5 w-2.5" />
                                  Required
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-[var(--gray-10)]">
                            {row.description || (
                              <span className="text-[var(--gray-8)] italic">
                                Unknown scope — shown as-is
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => revokeOne(row.scope)}
                              disabled={row.required || revokingScope !== null}
                              title={
                                row.required
                                  ? 'This scope is required for basic provider functionality. Revoke the whole credential to remove it.'
                                  : `Revoke ${row.scope}`
                              }
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                                row.required
                                  ? 'border-[var(--gray-4)] bg-[var(--gray-2)] text-[var(--gray-8)] cursor-not-allowed'
                                  : 'border-zoru-line bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 dark:border-zoru-line/40 dark:bg-zoru-ink/30 dark:text-zoru-ink-muted',
                              )}
                            >
                              {revokingScope === row.scope ? (
                                <LuLoader className="h-3 w-3 animate-spin" />
                              ) : (
                                <LuTrash2 className="h-3 w-3" />
                              )}
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {data.revoked.length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--gray-9)]">
                  <strong className="text-zoru-ink">{data.revoked.length}</strong>{' '}
                  scope{data.revoked.length === 1 ? '' : 's'} locally revoked —
                  SabFlow flows will refuse to use{' '}
                  {data.revoked.length === 1 ? 'it' : 'them'} even though the
                  provider may still consider {data.revoked.length === 1 ? 'it' : 'them'}{' '}
                  granted.
                </p>
              )}
            </section>

            {/* Grant additional scopes */}
            {data.provider === 'notion' ? (
              <section>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
                  Re-authorise
                </h2>
                <p className="mb-3 text-[11.5px] text-[var(--gray-9)]">
                  Notion does not use scope strings — access is granted
                  per-page by your workspace owner. Re-authorise to change
                  which pages this credential can see.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(new Set(['workspace']));
                    void grantAdditional();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zoru-ink px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zoru-ink"
                >
                  <LuRefreshCw className="h-3.5 w-3.5" />
                  Re-authorise with Notion
                </button>
              </section>
            ) : (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
                    Grant additional scopes
                  </h2>
                  {!pickerOpen && additionalCatalog.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
                    >
                      <LuPlus className="h-3 w-3" />
                      Pick scopes
                    </button>
                  )}
                </div>

                {additionalCatalog.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--gray-9)]">
                    No additional scopes from our catalogue to grant. You can
                    still re-authorise from the connections page to request
                    custom scopes.
                  </p>
                ) : !pickerOpen ? (
                  <p className="text-[11.5px] text-[var(--gray-9)]">
                    Pick from {additionalCatalog.length} available{' '}
                    {data.providerLabel} scope
                    {additionalCatalog.length === 1 ? '' : 's'} to request via
                    re-consent.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-[11.5px] text-[var(--gray-9)]">
                      Tick the scopes to add. You&apos;ll be redirected to{' '}
                      {data.providerLabel} to re-grant.
                    </p>
                    <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] p-3 max-h-96 overflow-y-auto">
                      {additionalCatalog.map((entry) => {
                        const checked = picked.has(entry.scope);
                        return (
                          <label
                            key={entry.scope}
                            className={cn(
                              'flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer',
                              checked
                                ? 'bg-zoru-surface-2 dark:bg-zoru-ink/30'
                                : 'hover:bg-[var(--gray-3)]',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePicked(entry.scope)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--gray-6)] accent-zoru-ink"
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="font-mono text-[11.5px] text-[var(--gray-12)]">
                                {entry.scope}
                              </span>
                              <span className="text-[11px] text-[var(--gray-9)]">
                                {entry.description}
                              </span>
                              {entry.category && (
                                <span className="mt-0.5 inline-block w-fit rounded px-1 py-0.5 text-[9.5px] font-medium uppercase tracking-wide bg-[var(--gray-3)] text-[var(--gray-9)]">
                                  {entry.category}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {grantError && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2 text-[11.5px] text-zoru-ink">
                        <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{grantError}</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={grantAdditional}
                        disabled={grantPending || picked.size === 0}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg bg-zoru-ink px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zoru-ink',
                          (grantPending || picked.size === 0) &&
                            'opacity-50 cursor-not-allowed',
                        )}
                      >
                        {grantPending ? (
                          <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LuRefreshCw className="h-3.5 w-3.5" />
                        )}
                        Request {picked.size}{' '}
                        {picked.size === 1 ? 'scope' : 'scopes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpen(false);
                          setPicked(new Set());
                          setGrantError(null);
                        }}
                        className="text-[11.5px] font-medium text-[var(--gray-10)] hover:text-[var(--gray-12)]"
                      >
                        Cancel
                      </button>
                      <span className="text-[11px] text-[var(--gray-9)]">
                        {picked.size === 0
                          ? 'Pick at least one scope to continue.'
                          : 'You will be redirected to the provider.'}
                      </span>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Revoke whole credential */}
            <section className="rounded-lg border border-zoru-line bg-zoru-surface-2 dark:border-zoru-line/40 dark:bg-zoru-ink/20 px-4 py-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink dark:text-zoru-ink-muted">
                Revoke entire credential
              </h2>
              <p className="mt-1 text-[11.5px] text-zoru-ink/80 dark:text-zoru-ink-muted/80 max-w-2xl">
                Permanently delete this credential. Any flow that references
                it will fail until you reconnect. This cannot be undone.
              </p>
              {destructiveError && (
                <div className="mt-2 flex items-start gap-1.5 text-[11.5px] text-zoru-ink">
                  <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{destructiveError}</span>
                </div>
              )}
              <button
                type="button"
                onClick={revokeWholeCredential}
                disabled={destructiveRevoking}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zoru-ink px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zoru-ink disabled:opacity-60"
              >
                {destructiveRevoking ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuTrash2 className="h-3.5 w-3.5" />
                )}
                {destructiveRevoking ? 'Revoking…' : 'Revoke credential'}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
