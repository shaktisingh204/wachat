'use client';

/**
 * SabCRM — Security & Access settings (`/sabcrm/settings/security`), Twenty-style.
 *
 * A self-contained, front-end-only security console modelled on Twenty's
 * Settings → Security page. There is no backend for any of this yet, so every
 * preference persists to `localStorage` via the inline `useSecurityPrefs` hook
 * and each section is honest about the fact that *enforcement* still needs a
 * server. Nothing here changes how the app actually authenticates — it captures
 * intent so the real backend can later read it.
 *
 * Sections (each a Twenty `.st-sec-card`):
 *
 *   1. Two-factor authentication — an enable toggle plus a method radio group
 *      (authenticator app / email code). UI only; turning it on does not yet
 *      challenge anyone.
 *   2. Sessions — a "this device" row (live, derived from the browser) and a
 *      "Sign out other sessions" button stub. There is no session registry yet,
 *      so the button only acknowledges the request.
 *   3. Password policy — minimum-length stepper and a "require symbols" toggle.
 *      Captured locally; rules aren't enforced at sign-up until wired server-side.
 *   4. IP allowlist — add / remove a list of IPs or CIDR ranges with light
 *      client-side validation. Advisory only until network enforcement exists.
 *   5. Approved email domains — add / remove a list of domains that invitations
 *      and sign-ups should be restricted to. Advisory only for now.
 *
 * Graceful states: the page waits for client hydration before rendering stored
 * values (avoids an SSR flash), shows inline empty states for the two lists, and
 * never throws on storage failure (the hook falls back to defaults in-memory).
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
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './security.css';

// ---------------------------------------------------------------------------
// Local preferences store
//
// A tiny localStorage-backed shape for the security console. Mirrors the
// `useCrmPrefs` pattern used elsewhere in settings, but kept inline here so the
// page is fully self-contained. Everything fails closed: SSR / private-mode /
// quota errors fall back to defaults and never throw.
// ---------------------------------------------------------------------------

type TwoFactorMethod = 'totp' | 'email';

interface SecurityPrefs {
  twoFactorEnabled: boolean;
  twoFactorMethod: TwoFactorMethod;
  passwordMinLength: number;
  passwordRequireSymbols: boolean;
  ipAllowlist: string[];
  emailDomains: string[];
}

const STORAGE_KEY = 'sabcrm.security.v1';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 64;

const DEFAULT_PREFS: SecurityPrefs = {
  twoFactorEnabled: false,
  twoFactorMethod: 'totp',
  passwordMinLength: 12,
  passwordRequireSymbols: false,
  ipAllowlist: [],
  emailDomains: [],
};

/** Coerce an arbitrary stored value into a safe, fully-typed prefs object. */
function coercePrefs(raw: unknown): SecurityPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const src = raw as Record<string, unknown>;

  const method: TwoFactorMethod = src.twoFactorMethod === 'email' ? 'email' : 'totp';

  let minLen = DEFAULT_PREFS.passwordMinLength;
  if (typeof src.passwordMinLength === 'number' && Number.isFinite(src.passwordMinLength)) {
    minLen = Math.min(
      MAX_PASSWORD_LENGTH,
      Math.max(MIN_PASSWORD_LENGTH, Math.round(src.passwordMinLength)),
    );
  }

  const toStringList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  return {
    twoFactorEnabled: src.twoFactorEnabled === true,
    twoFactorMethod: method,
    passwordMinLength: minLen,
    passwordRequireSymbols: src.passwordRequireSymbols === true,
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

  // Hydrate after mount so SSR and the first client render agree.
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

  // IPv6 (very loose): anything with a colon and only hex / colon / slash chars.
  if (v.includes(':')) {
    return /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(v);
  }

  // IPv4 with optional /CIDR.
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

/** Accessible on/off switch built on a checkbox (Twenty look). */
function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`st-switch${checked ? ' st-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch__thumb" aria-hidden="true" />
    </button>
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
// Page
// ---------------------------------------------------------------------------

export default function SabcrmSecuritySettingsPage(): React.JSX.Element {
  const { prefs, setPrefs, hydrated } = useSecurityPrefs();

  // Sessions stub — there is no session registry yet, so "sign out others" is
  // a local acknowledgement only.
  const [signedOutOthers, setSignedOutOthers] = React.useState(false);
  const deviceLabel = React.useMemo(describeThisDevice, []);

  const handleSignOutOthers = React.useCallback(() => {
    // No backend: just acknowledge locally and clear the flag after a moment.
    setSignedOutOthers(true);
    window.setTimeout(() => setSignedOutOthers(false), 4000);
  }, []);

  const stepMinLength = React.useCallback(
    (delta: number) => {
      const next = Math.min(
        MAX_PASSWORD_LENGTH,
        Math.max(MIN_PASSWORD_LENGTH, prefs.passwordMinLength + delta),
      );
      setPrefs({ passwordMinLength: next });
    },
    [prefs.passwordMinLength, setPrefs],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Security" icon={ShieldCheck} />
        <p className="st-settings__intro">
          Access controls for this workspace — two-factor authentication, active
          sessions, password rules, and network / domain allowlists. Preferences
          here are saved on this device; the notes call out where actual
          enforcement still needs server support.
        </p>

        {!hydrated ? (
          <SecuritySkeleton />
        ) : (
          <div className="st-sec-stack">
            {/* ------------------------------------------------------------ */}
            {/* Two-factor authentication                                     */}
            {/* ------------------------------------------------------------ */}
            <SecCard
              icon={ShieldCheck}
              title="Two-factor authentication"
              description="Require a second factor in addition to a password when signing in."
            >
              <ControlRow
                title="Enable two-factor authentication"
                hint="Adds a verification step after the password is accepted."
              >
                <Toggle
                  checked={prefs.twoFactorEnabled}
                  onChange={(next) => setPrefs({ twoFactorEnabled: next })}
                  label="Enable two-factor authentication"
                />
              </ControlRow>

              <fieldset
                className={`st-sec-radios${prefs.twoFactorEnabled ? '' : ' st-sec-radios--disabled'}`}
                disabled={!prefs.twoFactorEnabled}
              >
                <legend className="st-sec-radios__legend">Verification method</legend>

                <label className="st-sec-radio">
                  <input
                    type="radio"
                    name="twofa-method"
                    value="totp"
                    checked={prefs.twoFactorMethod === 'totp'}
                    onChange={() => setPrefs({ twoFactorMethod: 'totp' })}
                  />
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
                </label>

                <label className="st-sec-radio">
                  <input
                    type="radio"
                    name="twofa-method"
                    value="email"
                    checked={prefs.twoFactorMethod === 'email'}
                    onChange={() => setPrefs({ twoFactorMethod: 'email' })}
                  />
                  <span className="st-sec-radio__icon" aria-hidden="true">
                    <Mail size={15} />
                  </span>
                  <span className="st-sec-radio__text">
                    <span className="st-sec-radio__title">Email code</span>
                    <span className="st-sec-radio__desc">
                      Receive a one-time code by email at each sign-in.
                    </span>
                  </span>
                </label>
              </fieldset>

              <BackendNote>
                This captures your preference only. Two-factor challenges aren&apos;t
                issued yet — enforcement (enrolment, code verification, recovery
                codes) needs the authentication backend.
              </BackendNote>
            </SecCard>

            {/* ------------------------------------------------------------ */}
            {/* Sessions                                                      */}
            {/* ------------------------------------------------------------ */}
            <SecCard
              icon={Monitor}
              title="Sessions"
              description="Devices currently signed in to this workspace."
            >
              <div className="st-sec-session">
                <span className="st-sec-session__icon" aria-hidden="true">
                  <Monitor size={16} />
                </span>
                <div className="st-sec-session__text">
                  <span className="st-sec-session__title">
                    {deviceLabel}
                    <span className="st-sec-session__badge">This device</span>
                  </span>
                  <span className="st-sec-session__sub">Active now</span>
                </div>
              </div>

              <div className="st-sec-session__action">
                <TwentyButton
                  variant="secondary"
                  icon={signedOutOthers ? Check : LogOut}
                  onClick={handleSignOutOthers}
                  disabled={signedOutOthers}
                >
                  {signedOutOthers ? 'Requested' : 'Sign out other sessions'}
                </TwentyButton>
                {signedOutOthers ? (
                  <span className="st-sec-row__hint" role="status">
                    Acknowledged — other sessions will be cleared once session
                    tracking is live.
                  </span>
                ) : null}
              </div>

              <BackendNote>
                Only the current device can be shown — there&apos;s no session
                registry yet. Listing and revoking other devices needs the
                session store on the backend.
              </BackendNote>
            </SecCard>

            {/* ------------------------------------------------------------ */}
            {/* Password policy                                               */}
            {/* ------------------------------------------------------------ */}
            <SecCard
              icon={KeyRound}
              title="Password policy"
              description="Rules new and updated passwords must satisfy."
            >
              <ControlRow
                title="Minimum length"
                hint={`Between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`}
              >
                <div className="st-sec-stepper">
                  <button
                    type="button"
                    className="st-sec-stepper__btn"
                    aria-label="Decrease minimum length"
                    disabled={prefs.passwordMinLength <= MIN_PASSWORD_LENGTH}
                    onClick={() => stepMinLength(-1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="st-sec-stepper__value" aria-live="polite">
                    {prefs.passwordMinLength}
                  </span>
                  <button
                    type="button"
                    className="st-sec-stepper__btn"
                    aria-label="Increase minimum length"
                    disabled={prefs.passwordMinLength >= MAX_PASSWORD_LENGTH}
                    onClick={() => stepMinLength(1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </ControlRow>

              <ControlRow
                title="Require a symbol"
                hint="Passwords must contain at least one non-alphanumeric character."
              >
                <Toggle
                  checked={prefs.passwordRequireSymbols}
                  onChange={(next) => setPrefs({ passwordRequireSymbols: next })}
                  label="Require a symbol in passwords"
                />
              </ControlRow>

              <BackendNote>
                These rules are recorded locally. They aren&apos;t enforced at
                sign-up or password change until the authentication backend reads
                this policy.
              </BackendNote>
            </SecCard>

            {/* ------------------------------------------------------------ */}
            {/* IP allowlist                                                  */}
            {/* ------------------------------------------------------------ */}
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
                happen on the backend / edge.
              </BackendNote>
            </SecCard>

            {/* ------------------------------------------------------------ */}
            {/* Approved email domains                                        */}
            {/* ------------------------------------------------------------ */}
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
                sign-ups aren&apos;t actually filtered against them until the
                membership backend enforces the rule.
              </BackendNote>
            </SecCard>
          </div>
        )}
      </div>
    </div>
  );
}
