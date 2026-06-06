'use client';

/**
 * QuickBooks Online integration — settings page.
 *
 * Drives the OAuth lifecycle via:
 *   - `GET /api/integrations/quickbooks/connect`     — start OAuth
 *   - `GET /api/integrations/quickbooks/callback`    — Intuit redirect
 *   - `POST /api/integrations/quickbooks/disconnect` — clear tokens
 *
 * Reads / mutates settings through `@/app/actions/quickbooks.actions`.
 */

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Suspense, useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  LoaderCircle,
  Plug,
  PlugZap,
  RefreshCw,
  Receipt,
  Users,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  disconnectQuickBooks,
  getQuickBooksStatus,
  getQuickBooksSyncLog,
  saveQuickBooksCredentials,
  triggerSyncClients,
  triggerSyncInvoices,
} from '@/app/actions/quickbooks.actions';
import type { QuickBooksEnvironment } from '@/lib/integrations/quickbooks/types';

type Status = Awaited<ReturnType<typeof getQuickBooksStatus>>;
type SyncLog = Awaited<ReturnType<typeof getQuickBooksSyncLog>>;

const CONNECT_URL = '/api/integrations/quickbooks/connect';

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="h-3 w-3" /> Connected
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <AlertCircle className="h-3 w-3" /> Not connected
    </Badge>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function QuickBooksIntegrationPage() {
  return (
    <Suspense fallback={null}>
      <QuickBooksIntegrationInner />
    </Suspense>
  );
}

function QuickBooksIntegrationInner() {
  const { toast } = useZoruToast();
  const search = useSearchParams();

  const [status, setStatus] = useState<Status | null>(null);
  const [log, setLog] = useState<SyncLog>([]);
  const [, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isSyncingClients, startClientSync] = useTransition();
  const [isSyncingInvoices, startInvoiceSync] = useTransition();

  // Form state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [environment, setEnvironment] = useState<QuickBooksEnvironment>(
    'sandbox',
  );
  const [autoSync, setAutoSync] = useState(false);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [s, l] = await Promise.all([
        getQuickBooksStatus(),
        getQuickBooksSyncLog(),
      ]);
      setStatus(s);
      setLog(l);
      if (s.environment) setEnvironment(s.environment);
      if (typeof s.autoSync === 'boolean') setAutoSync(s.autoSync);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Surface OAuth round-trip results from URL params.
  useEffect(() => {
    const connected = search?.get('connected');
    const err = search?.get('error');
    if (connected === '1') {
      toast({
        title: 'QuickBooks connected',
        description: 'Tokens stored. You can now sync clients and invoices.',
      });
    } else if (err) {
      toast({
        title: 'QuickBooks connect failed',
        description: `Error code: ${err}`,
        variant: 'destructive',
      });
    }
    // We deliberately don't depend on the toast fn so this fires once per
    // navigation rather than on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onSaveCredentials = () => {
    startSaving(async () => {
      // Blank client_id / client_secret mean "keep the saved values" —
      // the action handles the keep-vs-replace logic.
      const res = await saveQuickBooksCredentials({
        client_id: clientId,
        client_secret: clientSecret,
        environment,
        autoSync,
      });
      if (res.ok) {
        toast({
          title: 'Credentials saved',
          description: 'You can now connect to QuickBooks.',
        });
        setClientSecret('');
        refresh();
      } else {
        toast({
          title: 'Save failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectQuickBooks();
      if (res.ok) {
        toast({ title: 'Disconnected from QuickBooks.' });
        refresh();
      } else {
        toast({
          title: 'Disconnect failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  };

  const onSyncClients = () => {
    startClientSync(async () => {
      const res = await triggerSyncClients();
      toast({
        title: res.ok ? 'Clients sync complete' : 'Clients sync finished with errors',
        description: `Synced ${res.result.ok} · Failed ${res.result.failed}`,
        variant: res.ok ? 'default' : 'destructive',
      });
      refresh();
    });
  };

  const onSyncInvoices = () => {
    startInvoiceSync(async () => {
      const res = await triggerSyncInvoices();
      toast({
        title: res.ok ? 'Invoices sync complete' : 'Invoices sync finished with errors',
        description: `Synced ${res.result.ok} · Failed ${res.result.failed}`,
        variant: res.ok ? 'default' : 'destructive',
      });
      refresh();
    });
  };

  const onCopyRedirect = async () => {
    if (!status?.redirectUri) return;
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      toast({ title: 'Redirect URI copied to clipboard' });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the field and copy manually.',
        variant: 'destructive',
      });
    }
  };

  const connected = Boolean(status?.connected);
  const hasCredentials = Boolean(status?.hasCredentials);

  return (
    <EntityListShell
      title="QuickBooks Online"
      subtitle="Push CRM clients and invoices into QuickBooks. OAuth 2.0 — tokens auto-refresh."
    >
      <div className="space-y-6">
        {/* ─── Connection panel ───────────────────────────────────────── */}
        <section className="rounded-lg border border-[var(--st-border)] bg-white p-4 dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Connection</h2>
                <StatusPill connected={connected} />
              </div>
              <p className="text-sm text-[var(--st-text)]">
                {connected
                  ? `Realm ${status?.realmId ?? '—'} · environment: ${status?.environment ?? '—'}`
                  : hasCredentials
                    ? 'Credentials saved. Click Connect to start the OAuth flow.'
                    : 'Save your QuickBooks app credentials below to enable the OAuth flow.'}
              </p>
              <p className="text-xs text-[var(--st-text)]">
                Last sync: {formatDate(status?.lastSync)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {connected ? (
                <>
                  <Button asChild variant="outline">
                    <a href={CONNECT_URL}>
                      <PlugZap className="h-4 w-4" /> Reconnect
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={onDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : null}
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button asChild disabled={!hasCredentials}>
                  <a href={CONNECT_URL}>
                    <Plug className="h-4 w-4" /> Connect to QuickBooks
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ─── Credentials form ───────────────────────────────────────── */}
        <section className="rounded-lg border border-[var(--st-border)] bg-white p-4 dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
          <header className="mb-4">
            <h2 className="text-base font-semibold">App credentials</h2>
            <p className="text-sm text-[var(--st-text)]">
              Create an app at{' '}
              <a
                href="https://developer.intuit.com/app/developer/myapps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                developer.intuit.com
              </a>{' '}
              and paste the credentials below.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="qbo-client-id">Client ID</Label>
              <div className="mt-1.5">
                <Input
                  id="qbo-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={hasCredentials ? '•••• (saved) — leave blank to keep' : ''}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="qbo-client-secret">Client Secret</Label>
              <div className="mt-1.5">
                <Input
                  id="qbo-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasCredentials ? '•••• (saved) — leave blank to keep' : ''}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="qbo-environment">Environment</Label>
              <div className="mt-1.5">
                <Select
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as QuickBooksEnvironment)}
                >
                  <ZoruSelectTrigger id="qbo-environment">
                    <ZoruSelectValue placeholder="Select environment" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="sandbox">Sandbox</ZoruSelectItem>
                    <ZoruSelectItem value="production">Production</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="qbo-redirect">Redirect URI</Label>
              <p className="mt-1 text-xs text-[var(--st-text)]">
                Add this URL to your QuickBooks app&apos;s allowed Redirect URIs
                in the Intuit developer dashboard.
              </p>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="qbo-redirect"
                  value={status?.redirectUri ?? ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopyRedirect}
                  disabled={!status?.redirectUri}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-md border border-[var(--st-border)] p-3 dark:border-[var(--st-border)]">
              <div>
                <p className="text-sm font-medium">Auto-sync on save</p>
                <p className="text-xs text-[var(--st-text)]">
                  When enabled, new clients and invoices are pushed to
                  QuickBooks automatically as they&apos;re saved.
                </p>
              </div>
              <Switch
                checked={autoSync}
                onCheckedChange={(v) => setAutoSync(Boolean(v))}
                aria-label="Toggle auto-sync"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={onSaveCredentials} disabled={isSaving}>
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </div>
        </section>

        {/* ─── Manual sync ────────────────────────────────────────────── */}
        <section className="rounded-lg border border-[var(--st-border)] bg-white p-4 dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
          <header className="mb-4">
            <h2 className="text-base font-semibold">Sync</h2>
            <p className="text-sm text-[var(--st-text)]">
              Push CRM data to QuickBooks. Only rows that haven&apos;t been
              synced yet are pushed.
            </p>
          </header>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={onSyncClients}
              disabled={!connected || isSyncingClients}
            >
              {isSyncingClients ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Sync All Clients
            </Button>
            <Button
              variant="outline"
              onClick={onSyncInvoices}
              disabled={!connected || isSyncingInvoices}
            >
              {isSyncingInvoices ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              Sync All Invoices
            </Button>
            <Button variant="ghost" onClick={refresh} disabled={isSaving}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </section>

        {/* ─── Sync log ───────────────────────────────────────────────── */}
        <section className="rounded-lg border border-[var(--st-border)] bg-white p-4 dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
          <header className="mb-3">
            <h2 className="text-base font-semibold">Recent sync activity</h2>
            <p className="text-sm text-[var(--st-text)]">Last 20 events.</p>
          </header>
          {log.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--st-text)]">
              No activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--st-border)] dark:divide-[var(--st-border)]">
              {log.map((row, idx) => (
                <li
                  key={`${row.timestamp}-${idx}`}
                  className="flex flex-wrap items-start justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {row.action} · {row.entity}
                      {row.refId ? ` · ${row.refId}` : ''}
                      {row.quickbooksId ? ` → QBO ${row.quickbooksId}` : ''}
                    </p>
                    {row.error ? (
                      <p className="mt-0.5 break-words text-xs text-[var(--st-text)]">
                        {row.error}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={row.status === 'success' ? 'success' : 'destructive'}
                    >
                      {row.status}
                    </Badge>
                    <time className="text-xs text-[var(--st-text)]">
                      {formatDate(row.timestamp)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </EntityListShell>
  );
}
