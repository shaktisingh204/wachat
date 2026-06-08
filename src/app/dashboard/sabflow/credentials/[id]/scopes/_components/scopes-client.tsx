'use client';

/**
 * ScopesClient
 *
 * UI for managing a single OAuth credential's granted scopes.
 *
 *   - GET  /api/sabflow/credentials/[id]/scopes
 *       -> provider, granted (with required flag + description), catalog,
 *         locally-revoked scope list.
 *   - DELETE /api/sabflow/credentials/[id]/scopes/[scope]
 *       -> soft-revoke a single scope (provider revoke endpoint when
 *         available, otherwise local-only).
 *   - POST  /api/sabflow/credentials/[id]/scopes
 *       -> request additional scopes (kicks off OAuth re-consent flow).
 *
 * Required scopes (provider-minimum) cannot be revoked individually; the
 * row's Revoke button is disabled with an explanatory tooltip. To kill the
 * whole credential, use the destructive section at the bottom.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';

/* -- Types (mirror the API response shape) ------------------------------- */

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

/* -- Component ----------------------------------------------------------- */

export function ScopesClient({ credentialId }: { credentialId: string }) {
  const router = useRouter();
  const { toast } = useToast();
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

  /* -- Load -------------------------------------------------------------- */

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

  /* -- Derived ----------------------------------------------------------- */

  const grantedScopeSet = useMemo(
    () => new Set((data?.granted ?? []).map((g) => g.scope)),
    [data],
  );

  const additionalCatalog = useMemo(() => {
    if (!data) return [];
    return data.catalog.filter((entry) => !grantedScopeSet.has(entry.scope));
  }, [data, grantedScopeSet]);

  /* -- Actions ----------------------------------------------------------- */

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
        toast.success(`Revoked "${scope}".`);
        await load();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to revoke';
        setScopeError(message);
        toast.error(message);
      } finally {
        setRevokingScope(null);
      }
    },
    [credentialId, load, revokingScope, toast],
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
      // Redirect the browser into the OAuth re-consent flow. The provider
      // will bounce back to /api/sabflow/oauth/callback which then redirects
      // back to this page.
      window.location.assign(json.authorizeUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to request scopes';
      setGrantError(message);
      toast.error(message);
      setGrantPending(false);
    }
  }, [credentialId, grantPending, picked, toast]);

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
      const message = e instanceof Error ? e.message : 'Failed to revoke';
      setDestructiveError(message);
      toast.error(message);
      setDestructiveRevoking(false);
    }
  }, [credentialId, destructiveRevoking, router, toast]);

  const togglePicked = (scope: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  /* -- Render ------------------------------------------------------------ */

  return (
    <div className="20ui flex flex-col h-full">
      {/* Header */}
      <PageHeader className="shrink-0 px-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          </span>
          <PageHeaderHeading>
            <PageTitle>Credential scopes</PageTitle>
            <PageDescription>
              {data?.providerLabel
                ? `${data.providerLabel} . what this credential is allowed to do`
                : 'Inspect, grant, or revoke OAuth permissions for this credential'}
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Link
            href="/dashboard/sabflow/connections"
            className="text-[12px] font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            All connections
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            loading={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading credential" />
            <span className="text-[12px]">Loading credential.</span>
          </div>
        ) : error ? (
          <div className="m-6">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : !data ? null : !data.isOAuth ? (
          <div className="flex h-64 items-center justify-center px-6">
            <EmptyState
              icon={ShieldCheck}
              title="No OAuth scopes for this credential"
              description="This credential uses a raw API key or static secret rather than an OAuth grant, so there are no per-scope permissions to inspect."
              action={
                <Link
                  href="/dashboard/sabflow/connections"
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--st-accent)] hover:opacity-80"
                >
                  Back to connections{' '}
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6 px-6 py-5">
            {/* Provider summary */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Provider"
                value={data.providerLabel ?? data.provider}
              />
              <StatCard
                label="Granted scopes"
                value={
                  <span className="tabular-nums">{data.granted.length}</span>
                }
              />
              {data.revoked.length > 0 && (
                <StatCard
                  label="Locally revoked"
                  value={
                    <span className="tabular-nums">{data.revoked.length}</span>
                  }
                />
              )}
            </div>

            {/* Granted scopes table */}
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Currently granted
              </h2>
              {scopeError && (
                <div className="mb-2">
                  <Alert tone="danger">{scopeError}</Alert>
                </div>
              )}
              <Card padding="none" className="overflow-hidden">
                <Table density="compact">
                  <THead>
                    <Tr>
                      <Th>Scope</Th>
                      <Th>Description</Th>
                      <Th align="right" width={128}>
                        Action
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {data.granted.length === 0 ? (
                      <Tr>
                        <Td
                          colSpan={3}
                          align="center"
                          className="text-[var(--st-text-secondary)]"
                        >
                          No scopes recorded on this credential.
                        </Td>
                      </Tr>
                    ) : (
                      data.granted.map((row) => (
                        <Tr key={row.scope}>
                          <Td className="align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11.5px] text-[var(--st-text)]">
                                {row.scope}
                              </span>
                              {row.required && (
                                <Badge
                                  tone="neutral"
                                  title="Required for basic provider functionality"
                                >
                                  <Lock
                                    className="h-2.5 w-2.5"
                                    aria-hidden="true"
                                  />
                                  Required
                                </Badge>
                              )}
                            </div>
                          </Td>
                          <Td className="text-[var(--st-text-secondary)]">
                            {row.description || (
                              <span className="text-[var(--st-text-tertiary)] italic">
                                Unknown scope, shown as-is
                              </span>
                            )}
                          </Td>
                          <Td align="right">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => revokeOne(row.scope)}
                              disabled={row.required || revokingScope !== null}
                              loading={revokingScope === row.scope}
                              iconLeft={Trash2}
                              title={
                                row.required
                                  ? 'This scope is required for basic provider functionality. Revoke the whole credential to remove it.'
                                  : `Revoke ${row.scope}`
                              }
                            >
                              Revoke
                            </Button>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </TBody>
                </Table>
              </Card>
              {data.revoked.length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--st-text-secondary)]">
                  <strong className="text-[var(--st-text)]">
                    {data.revoked.length}
                  </strong>{' '}
                  scope{data.revoked.length === 1 ? '' : 's'} locally revoked,
                  SabFlow flows will refuse to use{' '}
                  {data.revoked.length === 1 ? 'it' : 'them'} even though the
                  provider may still consider{' '}
                  {data.revoked.length === 1 ? 'it' : 'them'} granted.
                </p>
              )}
            </section>

            {/* Grant additional scopes */}
            {data.provider === 'notion' ? (
              <section>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                  Re-authorise
                </h2>
                <p className="mb-3 text-[11.5px] text-[var(--st-text-secondary)]">
                  Notion does not use scope strings, access is granted per-page
                  by your workspace owner. Re-authorise to change which pages
                  this credential can see.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={RefreshCw}
                  onClick={() => {
                    setPicked(new Set(['workspace']));
                    void grantAdditional();
                  }}
                >
                  Re-authorise with Notion
                </Button>
              </section>
            ) : (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Grant additional scopes
                  </h2>
                  {!pickerOpen && additionalCatalog.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={Plus}
                      onClick={() => setPickerOpen(true)}
                    >
                      Pick scopes
                    </Button>
                  )}
                </div>

                {additionalCatalog.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    No additional scopes from our catalogue to grant. You can
                    still re-authorise from the connections page to request
                    custom scopes.
                  </p>
                ) : !pickerOpen ? (
                  <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    Pick from {additionalCatalog.length} available{' '}
                    {data.providerLabel} scope
                    {additionalCatalog.length === 1 ? '' : 's'} to request via
                    re-consent.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-[11.5px] text-[var(--st-text-secondary)]">
                      Tick the scopes to add. You&apos;ll be redirected to{' '}
                      {data.providerLabel} to re-grant.
                    </p>
                    <Card padding="sm" className="max-h-96 overflow-y-auto">
                      <CardBody className="flex flex-col gap-1.5">
                        {additionalCatalog.map((entry) => {
                          const checked = picked.has(entry.scope);
                          return (
                            <label
                              key={entry.scope}
                              className={[
                                'flex items-start gap-2 rounded-[var(--st-radius)] px-2 py-1.5 cursor-pointer',
                                checked
                                  ? 'bg-[var(--st-bg-secondary)]'
                                  : 'hover:bg-[var(--st-bg-secondary)]',
                              ].join(' ')}
                            >
                              <Checkbox
                                size="sm"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => togglePicked(entry.scope)}
                                aria-label={`Add scope ${entry.scope}`}
                              />
                              <span className="flex flex-col leading-tight">
                                <span className="font-mono text-[11.5px] text-[var(--st-text)]">
                                  {entry.scope}
                                </span>
                                <span className="text-[11px] text-[var(--st-text-secondary)]">
                                  {entry.description}
                                </span>
                                {entry.category && (
                                  <Badge tone="neutral" className="mt-0.5 w-fit">
                                    {entry.category}
                                  </Badge>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </CardBody>
                    </Card>
                    {grantError && (
                      <div className="mt-2">
                        <Alert tone="danger">{grantError}</Alert>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={grantAdditional}
                        disabled={grantPending || picked.size === 0}
                        loading={grantPending}
                        iconLeft={RefreshCw}
                      >
                        Request {picked.size}{' '}
                        {picked.size === 1 ? 'scope' : 'scopes'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPickerOpen(false);
                          setPicked(new Set());
                          setGrantError(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <span className="text-[11px] text-[var(--st-text-secondary)]">
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
            <Card variant="outlined" padding="md">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-danger)]">
                Revoke entire credential
              </h2>
              <p className="mt-1 max-w-2xl text-[11.5px] text-[var(--st-text-secondary)]">
                Permanently delete this credential. Any flow that references it
                will fail until you reconnect. This cannot be undone.
              </p>
              {destructiveError && (
                <div className="mt-2">
                  <Alert tone="danger">{destructiveError}</Alert>
                </div>
              )}
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={revokeWholeCredential}
                disabled={destructiveRevoking}
                loading={destructiveRevoking}
                iconLeft={Trash2}
              >
                {destructiveRevoking ? 'Revoking.' : 'Revoke credential'}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
