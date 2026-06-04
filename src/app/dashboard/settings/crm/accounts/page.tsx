'use client';

/**
 * SabCRM — Accounts settings (`/dashboard/settings/crm/accounts`), Twenty-style.
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
 *      glyph, email, and a sync-status chip that always reads "Not syncing
 *      (engine offline)" because nothing is actually syncing. Each account has
 *      a Disconnect action and two UI-only toggles (Email sync / Calendar sync)
 *      that persist their on/off state but do nothing else.
 *
 * Persistence: the placeholder account list is mirrored to the gated CRM
 * settings document on the backend (via `useSettingsSync('accounts', …)` → the
 * `getCrmSettingsTw` / `updateCrmSettingsTw` server actions) AND a local
 * localStorage cache, so the list follows the user across devices while the page
 * never blocks. When the Rust settings engine is down it degrades to the
 * per-browser cache. No real OAuth or mailbox contact happens either way.
 * Graceful states: a hydration-safe initial render, an empty state when nothing
 * is connected, and the permanent "engine offline" sync status so the UI never
 * lies about syncing.
 */

import * as React from 'react';
import {
  Mail,
  AtSign,
  Plus,
  X,
  Trash2,
  Info,
  Inbox,
  CalendarDays,
  Link2,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useSettingsSync } from '../use-settings-sync';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './accounts.css';

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
    desc: 'Any mailbox over IMAP/SMTP. Requires host + credentials when live.',
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
// UI-only switch
// ---------------------------------------------------------------------------

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="st-switch"
      onClick={onChange}
    >
      <span className="st-switch__knob" aria-hidden="true" />
    </button>
  );
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
    <form className="st-connect-form" onSubmit={submit}>
      <div className="st-section__title" style={{ margin: 0 }}>
        <span className="st-section__title-icon" aria-hidden="true">
          <Glyph size={15} />
        </span>
        Connect a {provider.name} account
      </div>

      <div className="st-connect-form__row">
        <div className="st-field">
          <label className="st-field__label" htmlFor="connect-email">
            Email address
          </label>
          <input
            id="connect-email"
            className="st-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={
              provider.id === 'imap' ? 'you@yourdomain.com' : `you@${provider.name.toLowerCase()}.com`
            }
            autoFocus
          />
        </div>
        <TwentyButton type="submit" variant="primary" icon={Plus}>
          Add account
        </TwentyButton>
        <TwentyButton variant="secondary" onClick={onCancel}>
          Cancel
        </TwentyButton>
      </div>

      {error ? <p className="st-form-error">{error}</p> : null}

      <div className="st-invite-callout">
        <Info className="st-invite-callout__icon" size={14} aria-hidden="true" />
        <span>
          No real mailbox is contacted and no OAuth happens here — this adds a
          local placeholder account so you can preview the experience. Live
          syncing needs the backend mail/calendar engine, which isn&apos;t wired
          up yet.
        </span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAccountsSettingsPage(): React.JSX.Element {
  const { accounts, hydrated, offline, add, remove, toggle } =
    useConnectedAccounts();
  const [connecting, setConnecting] = React.useState<ProviderId | null>(null);

  const handleConnect = React.useCallback(
    (provider: ProviderId, email: string) => {
      add(provider, email);
      setConnecting(null);
    },
    [add],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Accounts" icon={Mail} />
        <p className="st-settings__intro">
          Connect the email and calendar accounts you want SabCRM to sync —
          messages, meetings and contacts flow in once an account is linked.
          Real provider OAuth and the sync engine aren&apos;t available yet, so
          connecting here creates a placeholder you can preview. Placeholders are
          saved to your workspace so they follow you across devices.
          {offline ? (
            <span className="st-accounts-offline" role="status">
              The settings service is offline — accounts are kept in this browser
              only for now.
            </span>
          ) : null}
        </p>

        {/* ---- Connect account ---- */}
        <section className="st-section" style={{ marginTop: 0 }}>
          <h2 className="st-section__title">
            <span className="st-section__title-icon" aria-hidden="true">
              <Link2 size={15} />
            </span>
            Connect an account
          </h2>
          <p className="st-section__desc">
            Choose a provider to link a mailbox and calendar.
          </p>

          {connecting ? (
            <ConnectForm
              provider={PROVIDER_BY_ID[connecting]}
              onCancel={() => setConnecting(null)}
              onConnect={(email) => handleConnect(connecting, email)}
            />
          ) : null}

          <div className="st-provider-grid">
            {PROVIDERS.map((provider) => {
              const { Glyph } = provider;
              const active = connecting === provider.id;
              return (
                <div key={provider.id} className="st-provider">
                  <div className="st-provider__head">
                    <span className="st-provider__glyph" aria-hidden="true">
                      <Glyph size={18} />
                    </span>
                    <span className="st-provider__name">{provider.name}</span>
                  </div>
                  <p className="st-provider__desc">{provider.desc}</p>
                  <div className="st-provider__action">
                    <TwentyButton
                      variant={active ? 'secondary' : 'primary'}
                      icon={active ? X : Plus}
                      onClick={() =>
                        setConnecting((cur) =>
                          cur === provider.id ? null : provider.id,
                        )
                      }
                    >
                      {active ? 'Cancel' : 'Connect'}
                    </TwentyButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- Connected accounts ---- */}
        <section className="st-section">
          <h2 className="st-section__title">
            <span className="st-section__title-icon" aria-hidden="true">
              <Inbox size={15} />
            </span>
            Connected accounts
          </h2>
          <p className="st-section__desc">
            Linked mailboxes and calendars. Nothing is actually syncing yet —
            the sync engine is offline, so every account shows as paused until
            the backend is available.
          </p>

          {!hydrated ? (
            <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
              <div className="st-skeleton st-skeleton-row" />
              <div className="st-skeleton st-skeleton-row" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="st-empty">
              <span className="st-empty__icon">
                <Inbox size={20} />
              </span>
              <h2 className="st-empty__title">No accounts connected</h2>
              <p className="st-empty__desc">
                Connect a Google, Microsoft or IMAP account above to see it here.
              </p>
            </div>
          ) : (
            <div className="st-account-list">
              {accounts.map((account) => {
                const provider = PROVIDER_BY_ID[account.provider];
                const { Glyph } = provider;
                return (
                  <div key={account.id} className="st-account">
                    <div className="st-account__head">
                      <span className="st-account__glyph" aria-hidden="true">
                        <Glyph size={18} />
                      </span>
                      <span className="st-account__meta">
                        <span className="st-account__email" title={account.email}>
                          {account.email}
                        </span>
                        <span className="st-account__provider">
                          {provider.name}
                        </span>
                      </span>
                      <span className="st-account__head-actions">
                        <span className="st-chip st-chip--idle" title="The sync engine is not running">
                          <span className="st-chip__dot" aria-hidden="true" />
                          <span className="st-chip__label">
                            Not syncing (engine offline)
                          </span>
                        </span>
                        <TwentyButton
                          variant="ghost"
                          icon={Trash2}
                          className="st-btn--danger"
                          onClick={() => remove(account.id)}
                          title="Disconnect account"
                        >
                          Disconnect
                        </TwentyButton>
                      </span>
                    </div>

                    <div className="st-account__sync">
                      <div className="st-sync-toggle">
                        <span className="st-sync-toggle__icon" aria-hidden="true">
                          <Inbox size={15} />
                        </span>
                        <span className="st-sync-toggle__text">
                          <span className="st-sync-toggle__label">Email sync</span>
                          <span className="st-sync-toggle__hint">
                            Import messages and contacts from this mailbox.
                          </span>
                        </span>
                        <Switch
                          checked={account.emailSync}
                          onChange={() => toggle(account.id, 'emailSync')}
                          label={`Toggle email sync for ${account.email}`}
                        />
                      </div>

                      <div className="st-sync-toggle">
                        <span className="st-sync-toggle__icon" aria-hidden="true">
                          <CalendarDays size={15} />
                        </span>
                        <span className="st-sync-toggle__text">
                          <span className="st-sync-toggle__label">
                            Calendar sync
                          </span>
                          <span className="st-sync-toggle__hint">
                            Pull events and meeting participants into timelines.
                          </span>
                        </span>
                        <Switch
                          checked={account.calendarSync}
                          onChange={() => toggle(account.id, 'calendarSync')}
                          label={`Toggle calendar sync for ${account.email}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
