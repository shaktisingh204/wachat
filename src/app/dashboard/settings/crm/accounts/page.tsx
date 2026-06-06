'use client';

/**
 * SabCRM — Accounts settings (`/dashboard/settings/crm/accounts`), pure 20ui.
 *
 * The "Connected accounts" surface: where a user would normally hook up their
 * Google / Microsoft / IMAP mailbox + calendar so SabCRM can sync messages,
 * meetings and contacts. Real provider OAuth and the sync engine aren't wired
 * up yet, so this page is an HONEST placeholder:
 *
 *   1. Connect account — a row of provider cards (Google, Microsoft, IMAP).
 *      Each "Connect" button reveals a tiny inline form (email address only)
 *      that adds a local placeholder "connected account" entry. A callout makes
 *      it clear that no real mailbox is contacted and that actual sync needs the
 *      backend engine.
 *
 *   2. Connected accounts — a list of the placeholder entries with provider
 *      glyph, email, and a sync-status badge that always reads "Not syncing
 *      (engine offline)" because nothing is actually syncing. Each account has
 *      a Disconnect action and two UI-only switches (Email sync / Calendar sync)
 *      that persist their on/off state but do nothing else.
 *
 * Persistence: the placeholder account list is mirrored to the gated CRM
 * settings document on the backend (via `useSettingsSync('accounts', …)`) AND a
 * local localStorage cache, so the list follows the user across devices while
 * the page never blocks. When the settings engine is down it degrades to the
 * per-browser cache. No real OAuth or mailbox contact happens either way.
 * Graceful states: a hydration-safe initial render, an empty state when nothing
 * is connected, and the permanent "engine offline" sync status so the UI never
 * lies about syncing.
 *
 * UI: pure 20ui (`@/components/sabcrm/20ui`) — Card / Field / Input / Button /
 * Switch / Badge / EmptyState / Alert / Callout / Skeleton / PageHeader — on the
 * `.sabcrm-twenty.ui20` scope established by the CRM settings shell. One accent,
 * built-in 20ui motion, tokenized Tailwind only (no `.st-*` classes / CSS).
 */

import * as React from 'react';
import {
  Mail,
  AtSign,
  Plus,
  X,
  Trash2,
  Inbox,
  CalendarDays,
  Link2,
  type LucideIcon,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Field,
  Input,
  Switch,
  Badge,
  EmptyState,
  Alert,
  Callout,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';

import { useSettingsSync } from '../use-settings-sync';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

type ProviderId = 'google' | 'microsoft' | 'imap';

interface ProviderInfo {
  id: ProviderId;
  name: string;
  Glyph: LucideIcon;
  desc: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google',
    Glyph: Mail,
    desc: 'Gmail and Google Calendar. Real connection uses Google OAuth.',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    Glyph: Mail,
    desc: 'Outlook / Microsoft 365 mail and calendar via Microsoft OAuth.',
  },
  {
    id: 'imap',
    name: 'IMAP',
    Glyph: AtSign,
    desc: 'Any mailbox over IMAP/SMTP. Requires host plus credentials when live.',
  },
];

const PROVIDER_BY_ID: Record<ProviderId, ProviderInfo> = PROVIDERS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<ProviderId, ProviderInfo>,
);

interface ConnectedAccount {
  id: string;
  provider: ProviderId;
  email: string;
  emailSync: boolean;
  calendarSync: boolean;
  connectedAt: string;
}

const STORAGE_KEY = 'sabcrm.settings.accounts.v1';

// ---------------------------------------------------------------------------
// localStorage-backed list (inline hook)
//
// Hydration-safe: starts empty on the server / first paint, then loads from
// localStorage in an effect so the markup matches between server and client.
// ---------------------------------------------------------------------------

/** Coerce the raw server slice into a clean account list (or null). */
function coerceAccounts(raw: unknown): ConnectedAccount[] | null {
  if (!Array.isArray(raw)) return null;
  const list = raw.filter(isAccount);
  return list;
}

function useConnectedAccounts() {
  const [accounts, setAccounts] = React.useState<ConnectedAccount[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const sync = useSettingsSync<ConnectedAccount[]>('accounts', coerceAccounts);

  // Initial load from localStorage (instant), reconciled by the server below.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setAccounts(parsed.filter(isAccount));
        }
      }
    } catch {
      /* corrupt / unavailable storage — start empty */
    } finally {
      setHydrated(true);
    }
  }, []);

  // When the server resolves a stored list, adopt it as the source of truth.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setAccounts(sync.remote);
  }, [sync.phase, sync.remote]);

  // Persist on every change (once hydrated, so we never clobber on first paint).
  // Mirrors to localStorage instantly and to the server (fire-and-forget).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }, [accounts, hydrated]);

  // Save a fully-resolved list to the server (kept out of the localStorage
  // effect so the server write happens only on real mutations, not on adopt).
  const persist = React.useCallback(
    (next: ConnectedAccount[]) => {
      void sync.save(next);
    },
    [sync],
  );

  const add = React.useCallback(
    (provider: ProviderId, email: string) => {
      setAccounts((prev) => {
        const next = [
          {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `acct_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            provider,
            email,
            emailSync: true,
            calendarSync: provider !== 'imap',
            connectedAt: new Date().toISOString(),
          },
          ...prev,
        ];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const remove = React.useCallback(
    (id: string) => {
      setAccounts((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggle = React.useCallback(
    (id: string, key: 'emailSync' | 'calendarSync') => {
      setAccounts((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, [key]: !a[key] } : a,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { accounts, hydrated, offline: sync.phase === 'offline', add, remove, toggle };
}

function isAccount(v: unknown): v is ConnectedAccount {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    (o.provider === 'google' || o.provider === 'microsoft' || o.provider === 'imap') &&
    typeof o.email === 'string'
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ---------------------------------------------------------------------------
// Connect form — revealed when a provider's "Connect" is pressed
// ---------------------------------------------------------------------------

function ConnectForm({
  provider,
  onCancel,
  onConnect,
}: {
  provider: ProviderInfo;
  onCancel: () => void;
  onConnect: (email: string) => void;
}): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) {
        setError('Enter the email address for this account.');
        return;
      }
      if (!isValidEmail(trimmed)) {
        setError('Enter a valid email address.');
        return;
      }
      onConnect(trimmed);
    },
    [email, onConnect],
  );

  const { Glyph } = provider;

  return (
    <Card
      variant="outlined"
      padding="md"
      className="mb-[var(--st-space-4)] border-[var(--st-accent)]/40 bg-[var(--st-accent-soft)]"
    >
      <form onSubmit={submit} className="flex flex-col gap-[var(--st-space-3)]">
        <CardTitle className="flex items-center gap-[var(--st-space-2)]">
          <Glyph size={15} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
          Connect a {provider.name} account
        </CardTitle>

        <div className="flex items-end gap-[var(--st-space-2)]">
          <Field
            label="Email address"
            error={error ?? undefined}
            className="min-w-0 flex-1"
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={
                provider.id === 'imap'
                  ? 'you@yourdomain.com'
                  : `you@${provider.name.toLowerCase()}.com`
              }
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" iconLeft={Plus}>
            Add account
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        <Callout tone="info">
          No real mailbox is contacted and no OAuth happens here. This adds a
          local placeholder account so you can preview the experience. Live
          syncing needs the backend mail/calendar engine, which is not wired up
          yet.
        </Callout>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAccountsSettingsPage(): React.JSX.Element {
  const { accounts, hydrated, offline, add, remove, toggle } =
    useConnectedAccounts();
  const [connecting, setConnecting] = React.useState<ProviderId | null>(null);
  const { toast } = useToast();

  const handleConnect = React.useCallback(
    (provider: ProviderId, email: string) => {
      add(provider, email);
      setConnecting(null);
      toast.success(`${email} added as a placeholder account.`);
    },
    [add, toast],
  );

  const handleRemove = React.useCallback(
    (id: string, email: string) => {
      remove(id);
      toast.info(`${email} disconnected.`);
    },
    [remove, toast],
  );

  return (
    <div className="flex flex-col gap-[var(--st-space-6)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCRM settings</PageEyebrow>
          <PageTitle className="flex items-center gap-[var(--st-space-2)]">
            <Mail size={20} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
            Accounts
          </PageTitle>
          <PageDescription>
            Connect the email and calendar accounts you want SabCRM to sync.
            Messages, meetings and contacts flow in once an account is linked.
            Real provider OAuth and the sync engine are not available yet, so
            connecting here creates a placeholder you can preview. Placeholders
            are saved to your workspace so they follow you across devices.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {offline ? (
        <Alert tone="warning" title="Settings service offline">
          The settings service is offline, so accounts are kept in this browser
          only for now.
        </Alert>
      ) : null}

      {/* ---- Connect an account ---- */}
      <section>
        <Card variant="ghost" padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-[var(--st-space-2)]">
              <Link2 size={15} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
              Connect an account
            </CardTitle>
            <CardDescription>
              Choose a provider to link a mailbox and calendar.
            </CardDescription>
          </CardHeader>

          <CardBody className="flex flex-col gap-[var(--st-space-3)]">
            {connecting ? (
              <ConnectForm
                provider={PROVIDER_BY_ID[connecting]}
                onCancel={() => setConnecting(null)}
                onConnect={(email) => handleConnect(connecting, email)}
              />
            ) : null}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[var(--st-space-3)]">
              {PROVIDERS.map((provider) => {
                const { Glyph } = provider;
                const active = connecting === provider.id;
                return (
                  <Card
                    key={provider.id}
                    variant="outlined"
                    padding="md"
                    className="flex flex-col gap-[var(--st-space-2)]"
                  >
                    <div className="flex items-center gap-[var(--st-space-2)]">
                      <span
                        className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      >
                        <Glyph size={18} />
                      </span>
                      <span className="font-[var(--st-fw-medium)] text-[var(--st-text)]">
                        {provider.name}
                      </span>
                    </div>
                    <p className="m-0 text-[length:var(--st-font-size-xs)] leading-[1.5] text-[var(--st-text-secondary)]">
                      {provider.desc}
                    </p>
                    <div className="mt-auto">
                      <Button
                        variant={active ? 'secondary' : 'primary'}
                        iconLeft={active ? X : Plus}
                        onClick={() =>
                          setConnecting((cur) =>
                            cur === provider.id ? null : provider.id,
                          )
                        }
                      >
                        {active ? 'Cancel' : 'Connect'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </section>

      {/* ---- Connected accounts ---- */}
      <section>
        <Card variant="ghost" padding="none">
          <CardHeader>
            <CardTitle className="flex items-center gap-[var(--st-space-2)]">
              <Inbox size={15} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
              Connected accounts
            </CardTitle>
            <CardDescription>
              Linked mailboxes and calendars. Nothing is actually syncing yet.
              The sync engine is offline, so every account shows as paused until
              the backend is available.
            </CardDescription>
          </CardHeader>

          <CardBody>
            {!hydrated ? (
              <div className="flex flex-col gap-[var(--st-space-3)]">
                <Skeleton height={64} radius="var(--st-radius)" />
                <Skeleton height={64} radius="var(--st-radius)" />
              </div>
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No accounts connected"
                description="Connect a Google, Microsoft or IMAP account above to see it here."
              />
            ) : (
              <div className="flex flex-col gap-[var(--st-space-3)]">
                {accounts.map((account) => {
                  const provider = PROVIDER_BY_ID[account.provider];
                  const { Glyph } = provider;
                  return (
                    <Card
                      key={account.id}
                      variant="outlined"
                      padding="none"
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-[var(--st-space-3)] p-[var(--st-space-3)]">
                        <span
                          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                          aria-hidden="true"
                        >
                          <Glyph size={18} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className="truncate font-[var(--st-fw-medium)] text-[var(--st-text)]"
                            title={account.email}
                          >
                            {account.email}
                          </span>
                          <span className="mt-px text-[length:var(--st-font-size-xs)] text-[var(--st-text-tertiary)]">
                            {provider.name}
                          </span>
                        </span>
                        <span className="ml-auto flex items-center gap-[var(--st-space-2)] whitespace-nowrap">
                          <Badge
                            tone="warning"
                            dot
                            title="The sync engine is not running"
                          >
                            Not syncing (engine offline)
                          </Badge>
                          <Button
                            variant="danger"
                            iconLeft={Trash2}
                            onClick={() => handleRemove(account.id, account.email)}
                            title="Disconnect account"
                          >
                            Disconnect
                          </Button>
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-[var(--st-space-3)] border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-3)]">
                        <div className="flex min-w-0 flex-[1_1_240px] items-center gap-[var(--st-space-2)]">
                          <span
                            className="flex-none text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          >
                            <Inbox size={15} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[length:var(--st-font-size-sm)] font-[var(--st-fw-medium)] text-[var(--st-text)]">
                              Email sync
                            </span>
                            <span className="text-[length:var(--st-font-size-xs)] text-[var(--st-text-secondary)]">
                              Import messages and contacts from this mailbox.
                            </span>
                          </span>
                          <Switch
                            checked={account.emailSync}
                            onCheckedChange={() => toggle(account.id, 'emailSync')}
                            aria-label={`Toggle email sync for ${account.email}`}
                            className="ml-auto"
                          />
                        </div>

                        <div className="flex min-w-0 flex-[1_1_240px] items-center gap-[var(--st-space-2)]">
                          <span
                            className="flex-none text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                          >
                            <CalendarDays size={15} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[length:var(--st-font-size-sm)] font-[var(--st-fw-medium)] text-[var(--st-text)]">
                              Calendar sync
                            </span>
                            <span className="text-[length:var(--st-font-size-xs)] text-[var(--st-text-secondary)]">
                              Pull events and meeting participants into timelines.
                            </span>
                          </span>
                          <Switch
                            checked={account.calendarSync}
                            onCheckedChange={() =>
                              toggle(account.id, 'calendarSync')
                            }
                            aria-label={`Toggle calendar sync for ${account.email}`}
                            className="ml-auto"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
