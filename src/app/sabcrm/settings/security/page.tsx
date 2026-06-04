'use client';

/**
 * SabCRM — Security & Access settings (`/sabcrm/settings/security`), Twenty-style.
 *
 * Modelled on Twenty's Settings → Security page and wired to the real account /
 * two-factor server actions that already exist in this codebase. Sections that
 * have a backend are live; the two that don't (IP allowlist, approved email
 * domains) stay honest local-only preferences with a clear note.
 *
 * Wired sections:
 *
 *   1. Two-factor authentication — live via `@/app/actions/two-fa.actions`:
 *      reads `getMy2faStatus`, enrols a TOTP authenticator
 *      (`generateAuthenticator2faSecret` → `verifyAuthenticator2faSetup`) or an
 *      email method (`enableEmail2fa` → `verifyEmail2faCode`), disables
 *      (`disable2fa(password)` for TOTP, `disableEmail2fa()` for email) and
 *      regenerates backup codes (`regenerateBackupCodes`). Real challenges,
 *      real backup codes, real persistence.
 *   2. Sessions — live via `@/app/actions/account.actions`: lists active
 *      sessions (`getActiveSessions`) and revokes everywhere
 *      (`signOutEverywhere`). The backend currently tracks only the current
 *      device, so the note is honest about per-device revocation.
 *   3. Recent sign-in activity — live via `getRecentLoginAttempts`.
 *   4. Password — live via `handleChangePassword` (`useActionState`). The server
 *      action currently validates but does not yet persist the new hash; the
 *      note says so.
 *
 * Honest local-only sections (no backend action exists):
 *
 *   5. IP allowlist — add / remove IPs or CIDR ranges (advisory).
 *   6. Approved email domains — add / remove domains (advisory).
 *
 * Graceful states: every action returns a typed result and is wrapped so a
 * missing/down backend degrades to an inline message rather than a throw. The
 * local lists persist to `localStorage` and never throw on storage failure.
 *
 * Rendered inside the settings layout's `TwentyAppFrame` (`.sabcrm-twenty`
 * scope); all visuals come from the `.st-*` Twenty design system plus this
 * page's `security.css`. No ZoruUI / Tailwind / clay.
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
  Info,
  LogOut,
  Minus,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
  History,
  Loader2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';

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

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './security.css';

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
    /* quota / private mode — preferences stay in-memory only */
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

  React.useEffect(() => {
    setPrefsState(readStored());
    setHydrated(true);
  }, []);

  const setPrefs = React.useCallback((patch: Partial<SecurityPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  }, []);

  return { prefs, setPrefs, hydrated };
}

// ---------------------------------------------------------------------------
// Validation helpers for the two managed lists
// ---------------------------------------------------------------------------

/**
 * Loose IPv4 / IPv4-CIDR sanity check. Intentionally permissive — this is an
 * advisory list, not a firewall — but it rejects obvious garbage so the list
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

/** Loose domain check — no scheme, no path, at least one dot. */
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

/** A Twenty-style settings card with an icon, title and supporting copy. */
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
    <section className="st-sec-card">
      <div className="st-sec-card__head">
        <span className="st-sec-card__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="st-sec-card__heading">
          <h2 className="st-sec-card__title">{title}</h2>
          <p className="st-sec-card__desc">{description}</p>
        </div>
      </div>
      <div className="st-sec-card__body">{children}</div>
    </section>
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
    <div className="st-sec-row">
      <div className="st-sec-row__text">
        <span className="st-sec-row__title">{title}</span>
        {hint ? <span className="st-sec-row__hint">{hint}</span> : null}
      </div>
      <div className="st-sec-row__control">{children}</div>
    </div>
  );
}

/** Honest "needs the backend" footnote shown inside a card. */
function BackendNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="st-sec-note">
      <Info className="st-sec-note__icon" size={14} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** A spinning loader icon sized for inline use in buttons. */
function Spinner(): React.JSX.Element {
  return <Loader2 size={14} className="st-sec-spin" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// List manager — shared by the IP allowlist and the email-domain list
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
    <div className="st-sec-list">
      <div className="st-sec-list__input">
        <input
          className="st-input"
          type="text"
          value={value}
          aria-label={inputLabel}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
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
        <TwentyButton variant="secondary" icon={Plus} onClick={add}>
          {addLabel}
        </TwentyButton>
      </div>

      {error ? <p className="st-form-error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="st-sec-list__empty">{emptyLabel}</p>
      ) : (
        <ul className="st-sec-chips">
          {items.map((item) => (
            <li
              key={item}
              className={`st-sec-chip${monospace ? ' st-sec-chip--mono' : ''}`}
            >
              <span className="st-sec-chip__value">{item}</span>
              <button
                type="button"
                className="st-sec-chip__remove"
                aria-label={`Remove ${item}`}
                onClick={() => remove(item)}
              >
                <X size={12} />
              </button>
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
    <div className="st-sec-stack" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="st-sec-card">
          <div className="st-sec-card__head">
            <div className="st-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div className="st-skeleton" style={{ width: 180, height: 13, marginBottom: 8 }} />
              <div className="st-skeleton" style={{ width: 280, height: 11 }} />
            </div>
          </div>
          <div className="st-sec-card__body">
            <div className="st-skeleton" style={{ height: 36 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "This device" descriptor — derived from the browser, best-effort.
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
// Backup-codes display block — reused after enrolment + regeneration.
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
        /* clipboard blocked — codes are still visible on screen */
      });
  }, [codes]);

  return (
    <div className="st-sec-backup">
      <div className="st-sec-backup__head">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>
          Save these backup codes somewhere safe. Each can be used once if you
          lose access to your second factor — they won&apos;t be shown again.
        </span>
      </div>
      <ul className="st-sec-backup__grid">
        {codes.map((c) => (
          <li key={c} className="st-sec-backup__code">
            {c}
          </li>
        ))}
      </ul>
      <div className="st-sec-backup__actions">
        <TwentyButton
          variant="secondary"
          icon={copied ? Check : Copy}
          onClick={copy}
        >
          {copied ? 'Copied' : 'Copy codes'}
        </TwentyButton>
        {onDone ? (
          <TwentyButton variant="primary" icon={Check} onClick={onDone}>
            I&apos;ve saved them
          </TwentyButton>
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
        <div className="st-sec-row">
          <span className="st-sec-row__hint">Loading two-factor status…</span>
        </div>
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
        <p className="st-form-error">{loadError}</p>
        <TwentyButton variant="secondary" icon={RefreshCw} onClick={() => void refresh()}>
          Retry
        </TwentyButton>
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
        <span
          className={`st-sec-state${enabled ? ' st-sec-state--on' : ''}`}
          aria-hidden="true"
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </ControlRow>

      {/* Just-enrolled / regenerated backup codes */}
      {shownBackupCodes ? (
        <BackupCodes
          codes={shownBackupCodes}
          onDone={() => setShownBackupCodes(null)}
        />
      ) : null}

      {actionError ? <p className="st-form-error">{actionError}</p> : null}

      {/* ---- Enabled: manage / disable ---- */}
      {enabled && !disableOpen ? (
        <div className="st-sec-session__action">
          <TwentyButton
            variant="secondary"
            icon={RefreshCw}
            onClick={() => void regenerate()}
            disabled={busy}
          >
            {busy ? <Spinner /> : null}
            Regenerate backup codes
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            icon={X}
            onClick={() => {
              setActionError(null);
              setDisableOpen(true);
            }}
            disabled={busy}
          >
            Turn off
          </TwentyButton>
          {status && status.backupCodesRemaining > 0 ? (
            <span className="st-sec-row__hint">
              {status.backupCodesRemaining} backup code
              {status.backupCodesRemaining === 1 ? '' : 's'} remaining.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ---- Disable confirmation ---- */}
      {enabled && disableOpen ? (
        <div className="st-sec-enroll">
          {status?.method === 'email' ? (
            <p className="st-sec-row__hint">
              This will remove email-based two-factor from your account.
            </p>
          ) : (
            <>
              <label className="st-sec-row__title" htmlFor="twofa-disable-pw">
                Confirm your password to turn off two-factor
              </label>
              <input
                id="twofa-disable-pw"
                className="st-input"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                placeholder="Your account password"
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </>
          )}
          <div className="st-sec-session__action">
            <TwentyButton
              variant="primary"
              icon={X}
              onClick={() => void disable()}
              disabled={busy || (status?.method !== 'email' && !disablePassword)}
            >
              {busy ? <Spinner /> : null}
              Turn off two-factor
            </TwentyButton>
            <TwentyButton
              variant="ghost"
              onClick={() => {
                setDisableOpen(false);
                setDisablePassword('');
                setActionError(null);
              }}
              disabled={busy}
            >
              Cancel
            </TwentyButton>
          </div>
        </div>
      ) : null}

      {/* ---- Disabled: enrolment ---- */}
      {!enabled && mode === 'idle' ? (
        <div className="st-sec-session__action">
          <TwentyButton
            variant="primary"
            icon={ShieldCheck}
            onClick={() => {
              setActionError(null);
              setMode('choose');
            }}
          >
            Enable two-factor
          </TwentyButton>
        </div>
      ) : null}

      {!enabled && mode === 'choose' ? (
        <fieldset className="st-sec-radios" disabled={busy}>
          <legend className="st-sec-radios__legend">Choose a method</legend>

          <button
            type="button"
            className="st-sec-radio st-sec-radio--button"
            onClick={() => void startTotp()}
            disabled={busy}
          >
            <span className="st-sec-radio__icon" aria-hidden="true">
              <Smartphone size={15} />
            </span>
            <span className="st-sec-radio__text">
              <span className="st-sec-radio__title">Authenticator app (TOTP)</span>
              <span className="st-sec-radio__desc">
                Use a time-based one-time code from an app like Google
                Authenticator or 1Password.
              </span>
            </span>
            {busy ? <Spinner /> : null}
          </button>

          <button
            type="button"
            className="st-sec-radio st-sec-radio--button"
            onClick={() => void startEmail()}
            disabled={busy}
          >
            <span className="st-sec-radio__icon" aria-hidden="true">
              <Mail size={15} />
            </span>
            <span className="st-sec-radio__text">
              <span className="st-sec-radio__title">Email code</span>
              <span className="st-sec-radio__desc">
                Receive a one-time code by email
                {status?.email ? ` at ${status.email}` : ''} at each sign-in.
              </span>
            </span>
            {busy ? <Spinner /> : null}
          </button>

          <TwentyButton variant="ghost" onClick={resetEnroll} disabled={busy}>
            Cancel
          </TwentyButton>
        </fieldset>
      ) : null}

      {/* ---- TOTP enrolment: show QR/secret + verify ---- */}
      {!enabled && mode === 'totp' ? (
        <div className="st-sec-enroll">
          <p className="st-sec-row__title">Scan this in your authenticator app</p>
          {totpQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="st-sec-qr" src={totpQr} alt="Two-factor QR code" />
          ) : null}
          {totpSecret ? (
            <p className="st-sec-row__hint">
              Or enter this key manually:{' '}
              <code className="st-sec-secret">{totpSecret}</code>
            </p>
          ) : null}
          <label className="st-sec-row__title" htmlFor="twofa-totp-code">
            Enter the 6-digit code from your app
          </label>
          <input
            id="twofa-totp-code"
            className="st-input st-sec-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            placeholder="000000"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void verify();
              }
            }}
          />
          <div className="st-sec-session__action">
            <TwentyButton
              variant="primary"
              icon={Check}
              onClick={() => void verify()}
              disabled={busy}
            >
              {busy ? <Spinner /> : null}
              Verify &amp; enable
            </TwentyButton>
            <TwentyButton variant="ghost" onClick={resetEnroll} disabled={busy}>
              Cancel
            </TwentyButton>
          </div>
        </div>
      ) : null}

      {/* ---- Email enrolment: verify ---- */}
      {!enabled && mode === 'email' ? (
        <div className="st-sec-enroll">
          <p className="st-sec-row__hint">
            We sent a 6-digit code{status?.email ? ` to ${status.email}` : ''}.
            Enter it below to turn on email two-factor.
          </p>
          <label className="st-sec-row__title" htmlFor="twofa-email-code">
            Verification code
          </label>
          <input
            id="twofa-email-code"
            className="st-input st-sec-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            placeholder="000000"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void verify();
              }
            }}
          />
          <div className="st-sec-session__action">
            <TwentyButton
              variant="primary"
              icon={Check}
              onClick={() => void verify()}
              disabled={busy}
            >
              {busy ? <Spinner /> : null}
              Verify &amp; enable
            </TwentyButton>
            <TwentyButton
              variant="secondary"
              icon={Mail}
              onClick={() => void startEmail()}
              disabled={busy}
            >
              Resend code
            </TwentyButton>
            <TwentyButton variant="ghost" onClick={resetEnroll} disabled={busy}>
              Cancel
            </TwentyButton>
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
      {loadError ? <p className="st-form-error">{loadError}</p> : null}

      {sessions === null && !loadError ? (
        <span className="st-sec-row__hint">Loading sessions…</span>
      ) : null}

      {sessions?.map((s) => (
        <div key={s.id} className="st-sec-session">
          <span className="st-sec-session__icon" aria-hidden="true">
            <Monitor size={16} />
          </span>
          <div className="st-sec-session__text">
            <span className="st-sec-session__title">
              {s.current ? deviceLabel : s.device}
              {s.current ? (
                <span className="st-sec-session__badge">This device</span>
              ) : null}
            </span>
            <span className="st-sec-session__sub">
              {s.current ? 'Active now' : s.location || s.ip || 'Signed in'}
            </span>
          </div>
        </div>
      ))}

      <div className="st-sec-session__action">
        <TwentyButton
          variant="secondary"
          icon={revoked ? Check : LogOut}
          onClick={() => void revokeAll()}
          disabled={revoking || revoked}
        >
          {revoking ? <Spinner /> : null}
          {revoked ? 'Signed out everywhere' : 'Sign out all sessions'}
        </TwentyButton>
        {revoked ? (
          <span className="st-sec-row__hint" role="status">
            All sessions revoked — every device, including this one, will be
            signed out on the next request.
          </span>
        ) : null}
      </div>

      <BackendNote>
        Sign-out everywhere revokes all tokens immediately. Per-device session
        rows aren&apos;t tracked yet, so only the current device is listed —
        once a session registry lands, every signed-in device will appear here
        with its own revoke control.
      </BackendNote>
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
      {loadError ? <p className="st-form-error">{loadError}</p> : null}

      {rows === null && !loadError ? (
        <span className="st-sec-row__hint">Loading activity…</span>
      ) : null}

      {rows && rows.length === 0 ? (
        <p className="st-sec-list__empty">No recent sign-in attempts recorded.</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <ul className="st-sec-activity">
          {rows.map((r) => (
            <li key={r._id} className="st-sec-activity__row">
              <span
                className={`st-sec-activity__dot st-sec-activity__dot--${r.status}`}
                aria-hidden="true"
              />
              <span className="st-sec-activity__text">
                <span className="st-sec-activity__status">
                  {r.status === 'success'
                    ? 'Successful sign-in'
                    : r.status === 'pending_2fa'
                      ? 'Awaiting two-factor'
                      : 'Failed attempt'}
                </span>
                <span className="st-sec-activity__meta">
                  {r.ip}
                  {r.userAgent && r.userAgent !== 'Unknown' ? ` · ${r.userAgent}` : ''}
                </span>
              </span>
              <span className="st-sec-activity__time">{relativeTime(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Password card — wired to `handleChangePassword` via useActionState.
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
      <form action={formAction} className="st-sec-form">
        <div className="st-sec-field">
          <label className="st-sec-row__title" htmlFor="pw-current">
            Current password
          </label>
          <input
            id="pw-current"
            name="currentPassword"
            className="st-input"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="st-sec-field">
          <label className="st-sec-row__title" htmlFor="pw-new">
            New password
          </label>
          <input
            id="pw-new"
            name="newPassword"
            className="st-input"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="st-sec-field">
          <label className="st-sec-row__title" htmlFor="pw-confirm">
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            name="confirmPassword"
            className="st-input"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {state.error ? <p className="st-form-error">{state.error}</p> : null}
        {state.message ? (
          <p className="st-form-success" role="status">
            {state.message}
          </p>
        ) : null}

        <div>
          <TwentyButton
            type="submit"
            variant="primary"
            icon={KeyRound}
            disabled={pending}
          >
            {pending ? <Spinner /> : null}
            Update password
          </TwentyButton>
        </div>
      </form>

      <BackendNote>
        Password rules are validated server-side. Note that the change-password
        action currently confirms the request without persisting a new hash —
        full enforcement lands with the account-credential backend.
      </BackendNote>
    </SecCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSecuritySettingsPage(): React.JSX.Element {
  const { prefs, setPrefs, hydrated } = useSecurityPrefs();

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Security" icon={ShieldCheck} />
        <p className="st-settings__intro">
          Access controls for your account and this workspace — two-factor
          authentication, active sessions, sign-in activity, your password, and
          network / domain allowlists. The notes call out where enforcement is
          live and where it still needs server support.
        </p>

        {!hydrated ? (
          <SecuritySkeleton />
        ) : (
          <div className="st-sec-stack">
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
                emptyLabel="No IP restrictions — access is allowed from any address."
                validate={isValidIpEntry}
                invalidMessage="Enter a valid IPv4/IPv6 address or CIDR range."
                onChange={(next) => setPrefs({ ipAllowlist: next })}
                monospace
              />

              <BackendNote>
                Listing addresses here doesn&apos;t block anything yet. Network
                enforcement (checking the request IP against this list) has to
                happen on the backend / edge — there&apos;s no IP-allowlist
                action to wire to.
              </BackendNote>
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
                emptyLabel="No domain restrictions — anyone can be invited."
                validate={isValidDomain}
                normalize={normalizeDomain}
                invalidMessage="Enter a valid domain like acme.com."
                onChange={(next) => setPrefs({ emailDomains: next })}
              />

              <BackendNote>
                Domains are stored locally as a preference. Invitations and
                sign-ups aren&apos;t filtered against them until the membership
                backend enforces the rule.
              </BackendNote>
            </SecCard>
          </div>
        )}
      </div>
    </div>
  );
}
