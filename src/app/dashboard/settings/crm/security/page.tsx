'use client';

/**
 * SabCRM - Security & Access settings (`/dashboard/settings/crm/security`).
 *
 * Pure 20ui rebuild. Wired to the real account / two-factor server actions that
 * already exist in this codebase. Sections that have a backend are live; the two
 * that don't (IP allowlist, approved email domains) stay honest local-only
 * preferences with a clear note.
 *
 * Wired sections:
 *
 *   1. Two-factor authentication - live via `@/app/actions/two-fa.actions`:
 *      reads `getMy2faStatus`, enrols a TOTP authenticator
 *      (`generateAuthenticator2faSecret` -> `verifyAuthenticator2faSetup`) or an
 *      email method (`enableEmail2fa` -> `verifyEmail2faCode`), disables
 *      (`disable2fa(password)` for TOTP, `disableEmail2fa()` for email) and
 *      regenerates backup codes (`regenerateBackupCodes`). Real challenges,
 *      real backup codes, real persistence.
 *   2. Sessions - live via `@/app/actions/account.actions`: lists active
 *      sessions (`getActiveSessions`) and revokes everywhere
 *      (`signOutEverywhere`). The backend currently tracks only the current
 *      device, so the note is honest about per-device revocation.
 *   3. Recent sign-in activity - live via `getRecentLoginAttempts`.
 *   4. Password - live via `handleChangePassword` (`useActionState`). The server
 *      action currently validates but does not yet persist the new hash; the
 *      note says so.
 *
 * Honest local-only sections (no backend action exists):
 *
 *   5. IP allowlist - add / remove IPs or CIDR ranges (advisory).
 *   6. Approved email domains - add / remove domains (advisory).
 *
 * Graceful states: every action returns a typed result and is wrapped so a
 * missing/down backend degrades to an inline message rather than a throw. The
 * local lists persist to `localStorage` and never throw on storage failure.
 *
 * Design system: 20ui (`@/components/sabcrm/20ui`) only - primitives + the
 * `--st-*` token palette. No Ui20 / Twenty / clay / raw controls.
 */

import * as React from 'react';
import {
  ShieldCheck,
  Smartphone,
  Mail,
  Monitor,
  KeyRound,
  Network,
  AtSign,
  Plus,
  X,
  LogOut,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
  History,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  IconButton,
  Input,
  Field,
  Badge,
  Dot,
  Callout,
  Spinner,
  Skeleton,
  RadioGroup,
  Radio,
} from '@/components/sabcrm/20ui';

import {
  getMy2faStatus,
  enableEmail2fa,
  verifyEmail2faCode,
  disableEmail2fa,
  generateAuthenticator2faSecret,
  verifyAuthenticator2faSetup,
  regenerateBackupCodes,
  disable2fa,
  getRecentLoginAttempts,
} from '@/app/actions/two-fa.actions';
import {
  getActiveSessions,
  signOutEverywhere,
} from '@/app/actions/account.actions';
import { handleChangePassword } from '@/app/actions/user.actions';
import { useSettingsSync } from '../use-settings-sync';

// ---------------------------------------------------------------------------
// Local preferences store (advisory IP allowlist + approved domains only)
//
// 2FA / sessions / password are server-backed now, so the local store only
// holds the two advisory lists that have no backend action. Everything fails
// closed: SSR / private-mode / quota errors fall back to defaults.
// ---------------------------------------------------------------------------

interface SecurityPrefs {
  ipAllowlist: string[];
  emailDomains: string[];
}

const STORAGE_KEY = 'sabcrm.security.v1';

const DEFAULT_PREFS: SecurityPrefs = {
  ipAllowlist: [],
  emailDomains: [],
};

/** Coerce an arbitrary stored value into a safe, fully-typed prefs object. */
function coercePrefs(raw: unknown): SecurityPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const src = raw as Record<string, unknown>;
  const toStringList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    ipAllowlist: toStringList(src.ipAllowlist),
    emailDomains: toStringList(src.emailDomains),
  };
}

/**
 * Coerce a server-stored `security` slice into prefs, or `null` when there is
 * no usable object (so the sync layer doesn't adopt over the local defaults).
 */
function coercePrefsOrNull(raw: unknown): SecurityPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  return coercePrefs(raw);
}

function readStored(): SecurityPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return coercePrefs(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeStored(prefs: SecurityPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode - preferences stay in-memory only */
  }
}

interface UseSecurityPrefsResult {
  prefs: SecurityPrefs;
  setPrefs: (patch: Partial<SecurityPrefs>) => void;
  hydrated: boolean;
}

function useSecurityPrefs(): UseSecurityPrefsResult {
  const [prefs, setPrefsState] = React.useState<SecurityPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = React.useState(false);
  // Server persistence via the typed `security` section (ipAllowlist +
  // emailDomains). localStorage stays the instant cache; the server copy
  // follows the workspace across devices. Fails closed (engine down -> cache).
  const sync = useSettingsSync<SecurityPrefs>('security', coercePrefsOrNull);

  React.useEffect(() => {
    setPrefsState(readStored());
    setHydrated(true);
  }, []);

  // Adopt the server-stored prefs as the source of truth once resolved.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setPrefsState(sync.remote);
    writeStored(sync.remote);
  }, [sync.phase, sync.remote]);

  const setPrefs = React.useCallback(
    (patch: Partial<SecurityPrefs>) => {
      setPrefsState((prev) => {
        const next = { ...prev, ...patch };
        writeStored(next);
        // Persist server-side (fire-and-forget; validated by the engine).
        void sync.save(next);
        return next;
      });
    },
    [sync],
  );

  return { prefs, setPrefs, hydrated };
}

// ---------------------------------------------------------------------------
// Validation helpers for the two managed lists
// ---------------------------------------------------------------------------

/**
 * Loose IPv4 / IPv4-CIDR sanity check. Intentionally permissive - this is an
 * advisory list, not a firewall - but it rejects obvious garbage so the list
 * stays meaningful. IPv6 is accepted in a minimal `:`-containing form.
 */
function isValidIpEntry(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  if (v.includes(':')) {
    return /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(v);
  }

  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(v);
  if (!m) return false;
  for (let i = 1; i <= 4; i += 1) {
    if (Number(m[i]) > 255) return false;
  }
  if (m[5] !== undefined && Number(m[5]) > 32) return false;
  return true;
}

/** Loose domain check - no scheme, no path, at least one dot. */
function isValidDomain(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) && !v.includes('..');
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '');
}

// ---------------------------------------------------------------------------
// Small presentational primitives (local to this page)
// ---------------------------------------------------------------------------

/** A 20ui settings card with a leading icon chip, title and supporting copy. */
function SecCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card variant="outlined" padding="lg">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            <Icon size={16} />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-4">{children}</div>
      </CardBody>
    </Card>
  );
}

/** A labelled row: text block on the left, control on the right. */
function ControlRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--st-text)]">{title}</span>
        {hint ? (
          <span className="text-xs text-[var(--st-text-secondary)]">{hint}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List manager - shared by the IP allowlist and the email-domain list
// ---------------------------------------------------------------------------

interface ListManagerProps {
  items: string[];
  placeholder: string;
  inputLabel: string;
  addLabel: string;
  emptyLabel: string;
  validate: (value: string) => boolean;
  normalize?: (value: string) => string;
  invalidMessage: string;
  onChange: (next: string[]) => void;
  monospace?: boolean;
}

function ListManager({
  items,
  placeholder,
  inputLabel,
  addLabel,
  emptyLabel,
  validate,
  normalize,
  invalidMessage,
  onChange,
  monospace = false,
}: ListManagerProps): React.JSX.Element {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const add = React.useCallback(() => {
    const candidate = (normalize ? normalize(value) : value).trim();
    if (!candidate) {
      setError(null);
      return;
    }
    if (!validate(candidate)) {
      setError(invalidMessage);
      return;
    }
    if (items.includes(candidate)) {
      setError('That entry is already in the list.');
      return;
    }
    onChange([...items, candidate]);
    setValue('');
    setError(null);
  }, [value, normalize, validate, invalidMessage, items, onChange]);

  const remove = React.useCallback(
    (entry: string) => {
      onChange(items.filter((i) => i !== entry));
    },
    [items, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <Field className="flex-1" label={inputLabel} error={error ?? undefined}>
          <Input
            type="text"
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            invalid={Boolean(error)}
            className={monospace ? 'font-mono' : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
        </Field>
        <Button variant="secondary" iconLeft={Plus} onClick={add}>
          {addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--st-text-secondary)]">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-1 pl-2.5 pr-1 text-xs text-[var(--st-text)]"
            >
              <span className={monospace ? 'font-mono' : undefined}>{item}</span>
              <IconButton
                size="sm"
                label={`Remove ${item}`}
                icon={X}
                onClick={() => remove(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SecuritySkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} variant="outlined" padding="lg">
          <div className="flex items-start gap-3">
            <Skeleton width={32} height={32} radius={6} />
            <div className="flex-1">
              <Skeleton width={180} height={13} className="mb-2" />
              <Skeleton width={280} height={11} />
            </div>
          </div>
          <div className="mt-4">
            <Skeleton width="100%" height={40} radius={6} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "This device" descriptor - derived from the browser, best-effort.
// ---------------------------------------------------------------------------

function describeThisDevice(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent || '';
  let os = 'Unknown OS';
  if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

  return `${browser} on ${os}`;
}

// ---------------------------------------------------------------------------
// Shared types mirrored from the server actions (kept local; not re-exported).
// ---------------------------------------------------------------------------

type TwoFactorMethod = 'totp' | 'email';

interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod | null;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
  email: string | null;
}

interface LoginAttemptRow {
  _id: string;
  ip: string;
  userAgent: string;
  status: 'success' | 'failed' | 'pending_2fa';
  createdAt: string | Date;
}

/**
 * Mirrors the (non-exported) `ActiveSession` shape returned by
 * `getActiveSessions` in `account.actions`. Declared locally so we don't depend
 * on a type the server-action module doesn't re-export.
 */
interface ActiveSession {
  id: string;
  device: string;
  ip?: string;
  location?: string;
  current: boolean;
  lastSeenAt: string;
}

// ---------------------------------------------------------------------------
// Backup-codes display block - reused after enrolment + regeneration.
// ---------------------------------------------------------------------------

function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone?: () => void;
}): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(() => {
    const text = codes.join('\n');
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        /* clipboard blocked - codes are still visible on screen */
      });
  }, [codes]);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <div className="flex items-start gap-2 text-xs text-[var(--st-text-secondary)]">
        <AlertTriangle
          size={14}
          className="mt-0.5 shrink-0 text-[var(--st-warn)]"
          aria-hidden="true"
        />
        <span>
          Save these backup codes somewhere safe. Each can be used once if you
          lose access to your second factor, and they won&apos;t be shown again.
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {codes.map((c) => (
          <li
            key={c}
            className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg)] px-2 py-1.5 text-center font-mono text-sm tracking-wider text-[var(--st-text)]"
          >
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          iconLeft={copied ? Check : Copy}
          onClick={copy}
        >
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        {onDone ? (
          <Button variant="primary" iconLeft={Check} onClick={onDone}>
            I&apos;ve saved them
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Two-factor authentication card
// ---------------------------------------------------------------------------

type EnrollMode = 'idle' | 'choose' | 'totp' | 'email';

function TwoFactorCard(): React.JSX.Element {
  const [status, setStatus] = React.useState<TwoFactorStatus | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [mode, setMode] = React.useState<EnrollMode>('idle');
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // TOTP enrolment payload (secret / QR / pending backup codes).
  const [totpSecret, setTotpSecret] = React.useState<string | null>(null);
  const [totpQr, setTotpQr] = React.useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = React.useState<string[] | null>(null);

  const [code, setCode] = React.useState('');

  // Codes to display after a successful enrol / regenerate.
  const [shownBackupCodes, setShownBackupCodes] = React.useState<string[] | null>(null);

  // Disable flow needs the account password for TOTP.
  const [disablePassword, setDisablePassword] = React.useState('');
  const [disableOpen, setDisableOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const res = await getMy2faStatus();
      if (res.ok && res.data) {
        setStatus(res.data as TwoFactorStatus);
        setLoadError(null);
      } else {
        setLoadError(res.error || 'Could not load two-factor status.');
      }
    } catch {
      setLoadError('Two-factor status is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetEnroll = React.useCallback(() => {
    setMode('idle');
    setBusy(false);
    setActionError(null);
    setTotpSecret(null);
    setTotpQr(null);
    setPendingBackup(null);
    setCode('');
  }, []);

  // --- Start TOTP enrolment ---
  const startTotp = React.useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await generateAuthenticator2faSecret();
      if (res.ok && res.data) {
        setTotpSecret(res.data.secret);
        setTotpQr(res.data.qrUrl);
        setPendingBackup(res.data.backupCodes);
        setMode('totp');
      } else {
        setActionError(res.error || 'Could not start authenticator setup.');
      }
    } catch {
      setActionError('Authenticator setup is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, []);

  // --- Start email enrolment ---
  const startEmail = React.useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await enableEmail2fa();
      if (res.ok) {
        setMode('email');
      } else {
        setActionError(res.error || 'Could not send a verification email.');
      }
    } catch {
      setActionError('Email verification is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, []);

  // --- Verify the entered 6-digit code for the active enrolment mode ---
  const verify = React.useCallback(async () => {
    if (!/^\d{6}$/.test(code)) {
      setActionError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res =
        mode === 'totp'
          ? await verifyAuthenticator2faSetup(code)
          : await verifyEmail2faCode(code);
      if (res.ok) {
        // TOTP enrolment shows the backup codes captured at start.
        if (mode === 'totp' && pendingBackup) {
          setShownBackupCodes(pendingBackup);
        }
        resetEnroll();
        await refresh();
      } else {
        setActionError(res.error || 'Verification failed.');
        setBusy(false);
      }
    } catch {
      setActionError('Verification is unavailable right now.');
      setBusy(false);
    }
  }, [code, mode, pendingBackup, resetEnroll, refresh]);

  // --- Disable ---
  const disable = React.useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res =
        status?.method === 'email'
          ? await disableEmail2fa()
          : await disable2fa(disablePassword);
      if (res.ok) {
        setDisableOpen(false);
        setDisablePassword('');
        setShownBackupCodes(null);
        await refresh();
      } else {
        setActionError(res.error || 'Could not disable two-factor authentication.');
      }
    } catch {
      setActionError('Disabling two-factor is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, [status?.method, disablePassword, refresh]);

  // --- Regenerate backup codes ---
  const regenerate = React.useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await regenerateBackupCodes();
      if (res.ok && res.data) {
        setShownBackupCodes(res.data.codes);
        await refresh();
      } else {
        setActionError(res.error || 'Could not regenerate backup codes.');
      }
    } catch {
      setActionError('Regenerating backup codes is unavailable right now.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  // ---- Render branches ----

  if (loading) {
    return (
      <SecCard
        icon={ShieldCheck}
        title="Two-factor authentication"
        description="Require a second factor in addition to a password when signing in."
      >
        <span className="text-xs text-[var(--st-text-secondary)]">
          Loading two-factor status.
        </span>
      </SecCard>
    );
  }

  if (loadError) {
    return (
      <SecCard
        icon={ShieldCheck}
        title="Two-factor authentication"
        description="Require a second factor in addition to a password when signing in."
      >
        <Callout tone="danger">{loadError}</Callout>
        <div>
          <Button variant="secondary" iconLeft={RefreshCw} onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      </SecCard>
    );
  }

  const enabled = Boolean(status?.enabled);

  return (
    <SecCard
      icon={ShieldCheck}
      title="Two-factor authentication"
      description="Require a second factor in addition to a password when signing in."
    >
      {/* Current state row */}
      <ControlRow
        title={enabled ? 'Two-factor is on' : 'Two-factor is off'}
        hint={
          enabled
            ? status?.method === 'totp'
              ? 'Using an authenticator app (TOTP).'
              : 'Using one-time email codes.'
            : 'Protect your account by requiring a second factor at sign-in.'
        }
      >
        <Badge tone={enabled ? 'success' : 'neutral'} dot>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </ControlRow>

      {/* Just-enrolled / regenerated backup codes */}
      {shownBackupCodes ? (
        <BackupCodes
          codes={shownBackupCodes}
          onDone={() => setShownBackupCodes(null)}
        />
      ) : null}

      {actionError ? <Callout tone="danger">{actionError}</Callout> : null}

      {/* ---- Enabled: manage / disable ---- */}
      {enabled && !disableOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            loading={busy}
            onClick={() => void regenerate()}
          >
            Regenerate backup codes
          </Button>
          <Button
            variant="secondary"
            iconLeft={X}
            disabled={busy}
            onClick={() => {
              setActionError(null);
              setDisableOpen(true);
            }}
          >
            Turn off
          </Button>
          {status && status.backupCodesRemaining > 0 ? (
            <span className="text-xs text-[var(--st-text-secondary)]">
              {status.backupCodesRemaining} backup code
              {status.backupCodesRemaining === 1 ? '' : 's'} remaining.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ---- Disable confirmation ---- */}
      {enabled && disableOpen ? (
        <div className="flex flex-col gap-3">
          {status?.method === 'email' ? (
            <p className="text-xs text-[var(--st-text-secondary)]">
              This will remove email-based two-factor from your account.
            </p>
          ) : (
            <Field label="Confirm your password to turn off two-factor">
              <Input
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                placeholder="Your account password"
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </Field>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              iconLeft={X}
              loading={busy}
              disabled={status?.method !== 'email' && !disablePassword}
              onClick={() => void disable()}
            >
              Turn off two-factor
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDisableOpen(false);
                setDisablePassword('');
                setActionError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---- Disabled: enrolment ---- */}
      {!enabled && mode === 'idle' ? (
        <div>
          <Button
            variant="primary"
            iconLeft={ShieldCheck}
            onClick={() => {
              setActionError(null);
              setMode('choose');
            }}
          >
            Enable two-factor
          </Button>
        </div>
      ) : null}

      {!enabled && mode === 'choose' ? (
        <div className="flex flex-col gap-3">
          <RadioGroup
            aria-label="Choose a two-factor method"
            value=""
            onValueChange={(next) => {
              if (busy) return;
              if (next === 'totp') void startTotp();
              else if (next === 'email') void startEmail();
            }}
          >
            <span className="text-sm font-medium text-[var(--st-text)]">
              Choose a method
            </span>

            <Radio
              value="totp"
              disabled={busy}
              label={
                <span className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  >
                    <Smartphone size={15} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      Authenticator app (TOTP)
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      Use a time-based one-time code from an app like Google
                      Authenticator or 1Password.
                    </span>
                  </span>
                </span>
              }
            />

            <Radio
              value="email"
              disabled={busy}
              label={
                <span className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  >
                    <Mail size={15} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      Email code
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      Receive a one-time code by email
                      {status?.email ? ` at ${status.email}` : ''} at each
                      sign-in.
                    </span>
                  </span>
                </span>
              }
            />
          </RadioGroup>

          <div className="flex items-center gap-2">
            {busy ? <Spinner size="sm" /> : null}
            <Button variant="ghost" onClick={resetEnroll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---- TOTP enrolment: show QR/secret + verify ---- */}
      {!enabled && mode === 'totp' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-[var(--st-text)]">
            Scan this in your authenticator app
          </p>
          {totpQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="h-40 w-40 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2"
              src={totpQr}
              alt="Two-factor QR code"
            />
          ) : null}
          {totpSecret ? (
            <p className="text-xs text-[var(--st-text-secondary)]">
              Or enter this key manually:{' '}
              <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-mono text-[var(--st-text)]">
                {totpSecret}
              </code>
            </p>
          ) : null}
          <Field label="Enter the 6-digit code from your app">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              placeholder="000000"
              className="max-w-[10rem] font-mono tracking-[0.4em]"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void verify();
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              iconLeft={Check}
              loading={busy}
              onClick={() => void verify()}
            >
              Verify and enable
            </Button>
            <Button variant="ghost" onClick={resetEnroll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---- Email enrolment: verify ---- */}
      {!enabled && mode === 'email' ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--st-text-secondary)]">
            We sent a 6-digit code{status?.email ? ` to ${status.email}` : ''}.
            Enter it below to turn on email two-factor.
          </p>
          <Field label="Verification code">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              placeholder="000000"
              className="max-w-[10rem] font-mono tracking-[0.4em]"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void verify();
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              iconLeft={Check}
              loading={busy}
              onClick={() => void verify()}
            >
              Verify and enable
            </Button>
            <Button
              variant="secondary"
              iconLeft={Mail}
              disabled={busy}
              onClick={() => void startEmail()}
            >
              Resend code
            </Button>
            <Button variant="ghost" onClick={resetEnroll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Sessions card
// ---------------------------------------------------------------------------

function SessionsCard(): React.JSX.Element {
  const [sessions, setSessions] = React.useState<ActiveSession[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const deviceLabel = React.useMemo(describeThisDevice, []);

  const [revoking, setRevoking] = React.useState(false);
  const [revoked, setRevoked] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await getActiveSessions();
        if (active) setSessions(list);
      } catch {
        if (active) setLoadError('Could not load active sessions.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const revokeAll = React.useCallback(async () => {
    setRevoking(true);
    try {
      await signOutEverywhere();
      setRevoked(true);
      // The current session cookie is cleared server-side; the next navigation
      // drops to /login. Reflect the request locally in the meantime.
    } catch {
      setLoadError('Could not sign out other sessions.');
    } finally {
      setRevoking(false);
    }
  }, []);

  return (
    <SecCard
      icon={Monitor}
      title="Sessions"
      description="Devices currently signed in to this workspace."
    >
      {loadError ? <Callout tone="danger">{loadError}</Callout> : null}

      {sessions === null && !loadError ? (
        <span className="text-xs text-[var(--st-text-secondary)]">
          Loading sessions.
        </span>
      ) : null}

      {sessions?.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
            aria-hidden="true"
          >
            <Monitor size={16} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
              {s.current ? deviceLabel : s.device}
              {s.current ? (
                <Badge tone="accent" kind="soft">
                  This device
                </Badge>
              ) : null}
            </span>
            <span className="text-xs text-[var(--st-text-secondary)]">
              {s.current ? 'Active now' : s.location || s.ip || 'Signed in'}
            </span>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          iconLeft={revoked ? Check : LogOut}
          loading={revoking}
          disabled={revoked}
          onClick={() => void revokeAll()}
        >
          {revoked ? 'Signed out everywhere' : 'Sign out all sessions'}
        </Button>
        {revoked ? (
          <span className="text-xs text-[var(--st-text-secondary)]" role="status">
            All sessions revoked. Every device, including this one, will be
            signed out on the next request.
          </span>
        ) : null}
      </div>

      <Callout tone="info">
        Sign-out everywhere revokes all tokens immediately. Per-device session
        rows aren&apos;t tracked yet, so only the current device is listed. Once
        a session registry lands, every signed-in device will appear here with
        its own revoke control.
      </Callout>
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Recent sign-in activity card
// ---------------------------------------------------------------------------

function relativeTime(value: string | Date): string {
  const then = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

function LoginActivityCard(): React.JSX.Element {
  const [rows, setRows] = React.useState<LoginAttemptRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await getRecentLoginAttempts();
        if (!active) return;
        if (res.ok && res.data) {
          setRows(res.data as LoginAttemptRow[]);
        } else {
          setLoadError(res.error || 'Could not load sign-in history.');
        }
      } catch {
        if (active) setLoadError('Sign-in history is unavailable right now.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SecCard
      icon={History}
      title="Recent sign-in activity"
      description="The last few attempts to sign in to your account."
    >
      {loadError ? <Callout tone="danger">{loadError}</Callout> : null}

      {rows === null && !loadError ? (
        <span className="text-xs text-[var(--st-text-secondary)]">
          Loading activity.
        </span>
      ) : null}

      {rows && rows.length === 0 ? (
        <p className="text-xs text-[var(--st-text-secondary)]">
          No recent sign-in attempts recorded.
        </p>
      ) : null}

      {rows && rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li
              key={r._id}
              className="flex items-center gap-3 border-b border-[var(--st-border-light)] py-2.5 last:border-b-0"
            >
              <Dot
                tone={
                  r.status === 'success'
                    ? 'success'
                    : r.status === 'pending_2fa'
                      ? 'warning'
                      : 'danger'
                }
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-[var(--st-text)]">
                  {r.status === 'success'
                    ? 'Successful sign-in'
                    : r.status === 'pending_2fa'
                      ? 'Awaiting two-factor'
                      : 'Failed attempt'}
                </span>
                <span className="truncate text-xs text-[var(--st-text-secondary)]">
                  {r.ip}
                  {r.userAgent && r.userAgent !== 'Unknown' ? `, ${r.userAgent}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[var(--st-text-tertiary)]">
                {relativeTime(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Password card - wired to `handleChangePassword` via useActionState.
// ---------------------------------------------------------------------------

const PASSWORD_INITIAL: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

function PasswordCard(): React.JSX.Element {
  const [state, formAction, pending] = React.useActionState(
    handleChangePassword,
    PASSWORD_INITIAL,
  );

  return (
    <SecCard
      icon={KeyRound}
      title="Password"
      description="Change the password used to sign in to your account."
    >
      <form action={formAction} className="flex flex-col gap-3">
        <Field label="Current password">
          <Input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password">
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </Field>

        {state.error ? <Callout tone="danger">{state.error}</Callout> : null}
        {state.message ? (
          <Callout tone="success">{state.message}</Callout>
        ) : null}

        <div>
          <Button
            type="submit"
            variant="primary"
            iconLeft={KeyRound}
            loading={pending}
          >
            Update password
          </Button>
        </div>
      </form>

      <Callout tone="info">
        Password rules are validated server-side. Note that the change-password
        action currently confirms the request without persisting a new hash.
        Full enforcement lands with the account-credential backend.
      </Callout>
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSecuritySettingsPage(): React.JSX.Element {
  const { prefs, setPrefs, hydrated } = useSecurityPrefs();

  return (
    <div className="ui20">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Security</PageTitle>
            <PageDescription>
              Access controls for your account and this workspace: two-factor
              authentication, active sessions, sign-in activity, your password,
              and network / domain allowlists. The notes call out where
              enforcement is live and where it still needs server support.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {!hydrated ? (
          <SecuritySkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Two-factor authentication (live) */}
            <TwoFactorCard />

            {/* Sessions (live) */}
            <SessionsCard />

            {/* Recent sign-in activity (live) */}
            <LoginActivityCard />

            {/* Password (live action; placeholder persistence) */}
            <PasswordCard />

            {/* IP allowlist (local-only advisory) */}
            <SecCard
              icon={Network}
              title="IP allowlist"
              description="Restrict workspace access to specific IP addresses or CIDR ranges."
            >
              <ListManager
                items={prefs.ipAllowlist}
                placeholder="e.g. 203.0.113.7 or 10.0.0.0/24"
                inputLabel="IP address or CIDR range"
                addLabel="Add IP"
                emptyLabel="No IP restrictions. Access is allowed from any address."
                validate={isValidIpEntry}
                invalidMessage="Enter a valid IPv4/IPv6 address or CIDR range."
                onChange={(next) => setPrefs({ ipAllowlist: next })}
                monospace
              />

              <Callout tone="info">
                Listing addresses here doesn&apos;t block anything yet. Network
                enforcement (checking the request IP against this list) has to
                happen on the backend / edge. There&apos;s no IP-allowlist
                action to wire to.
              </Callout>
            </SecCard>

            {/* Approved email domains (local-only advisory) */}
            <SecCard
              icon={AtSign}
              title="Approved email domains"
              description="Limit invitations and sign-ups to people at these domains."
            >
              <ListManager
                items={prefs.emailDomains}
                placeholder="e.g. acme.com"
                inputLabel="Email domain"
                addLabel="Add domain"
                emptyLabel="No domain restrictions. Anyone can be invited."
                validate={isValidDomain}
                normalize={normalizeDomain}
                invalidMessage="Enter a valid domain like acme.com."
                onChange={(next) => setPrefs({ emailDomains: next })}
              />

              <Callout tone="info">
                Domains are stored locally as a preference. Invitations and
                sign-ups aren&apos;t filtered against them until the membership
                backend enforces the rule.
              </Callout>
            </SecCard>
          </div>
        )}
      </div>
    </div>
  );
}
