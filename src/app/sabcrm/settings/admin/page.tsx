'use client';

/**
 * SabCRM — Admin Panel settings (`/sabcrm/settings/admin`), Twenty-style.
 *
 * A Twenty-parity "Admin Panel" surface. Twenty's admin panel groups a handful
 * of operator-level concerns (config variables, signing keys, health status, AI
 * providers); this page mirrors that structure in the SabNode/SabCRM frame.
 *
 * IMPORTANT — honesty over theatre. Most of these concerns have no backend wired
 * up in SabCRM yet, so every section is explicit about where its data really
 * lives:
 *
 *   - Health — a few best-effort status rows (CRM engine reachable? backing
 *     services?). The probe is a client-side fetch that will usually fail
 *     because the engine may be down or unexposed to the browser; rows then show
 *     "Unknown" / "Offline" honestly rather than faking "OK".
 *   - Config variables — a read-only / locally-editable list of CRM config keys.
 *     Edits persist to `localStorage` only (clearly labelled "local override"),
 *     never to a server.
 *   - Signing keys — a stubbed "rotate keys" placeholder. No keys are actually
 *     issued or rotated; the button surfaces an honest "not wired up" notice.
 *   - AI providers — provider + API-key fields persisted to `localStorage` only,
 *     with an explicit note that nothing is sent anywhere.
 *
 * Editable surface for this task is ONLY this page + its `admin.css`. No server
 * actions are introduced. Graceful, fail-closed states throughout.
 */

import * as React from 'react';
import {
  ShieldAlert,
  Activity,
  SlidersHorizontal,
  KeyRound,
  Sparkles,
  Info,
  RefreshCw,
  Save,
  Check,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './admin.css';

// ---------------------------------------------------------------------------
// Local admin-panel store
//
// Self-contained localStorage shim — these settings have no backend, so they
// live on the device. Fails closed: SSR / private-mode / quota errors fall back
// to defaults and never throw.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sabcrm.admin.v1';

interface AdminLocalState {
  /** Local overrides for config-variable values, keyed by config key. */
  config: Record<string, string>;
  /** AI provider id (e.g. 'openai'). */
  aiProvider: string;
  /** AI provider API key — stored locally only. */
  aiApiKey: string;
}

const DEFAULT_STATE: AdminLocalState = {
  config: {},
  aiProvider: 'openai',
  aiApiKey: '',
};

function readStored(): Partial<AdminLocalState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Partial<AdminLocalState>;
    return {};
  } catch {
    return {};
  }
}

function writeStored(state: AdminLocalState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — settings stay in-memory only */
  }
}

// ---------------------------------------------------------------------------
// Static descriptors
// ---------------------------------------------------------------------------

type TabId = 'health' | 'config' | 'keys' | 'ai';

interface TabDescriptor {
  id: TabId;
  label: string;
  Icon: React.ElementType;
}

const TABS: TabDescriptor[] = [
  { id: 'health', label: 'Health', Icon: Activity },
  { id: 'config', label: 'Config variables', Icon: SlidersHorizontal },
  { id: 'keys', label: 'Signing keys', Icon: KeyRound },
  { id: 'ai', label: 'AI providers', Icon: Sparkles },
];

/**
 * The CRM config keys surfaced for inspection. Defaults describe the typical
 * server-side value; the actual runtime value isn't readable from the browser,
 * so these are presented as reference + locally-overridable, never authoritative.
 */
interface ConfigDescriptor {
  key: string;
  hint: string;
  defaultValue: string;
}

const CONFIG_KEYS: ConfigDescriptor[] = [
  {
    key: 'SABCRM_ENGINE_URL',
    hint: 'Base URL the Next.js layer uses to reach the CRM engine.',
    defaultValue: 'http://127.0.0.1:4101',
  },
  {
    key: 'SABCRM_DEFAULT_PAGE_SIZE',
    hint: 'Default record page size for record views.',
    defaultValue: '50',
  },
  {
    key: 'SABCRM_ATTACHMENT_MAX_MB',
    hint: 'Maximum attachment size accepted on records, in megabytes.',
    defaultValue: '20',
  },
  {
    key: 'SABCRM_FEATURE_WORKFLOWS',
    hint: 'Toggle for the workflow automations module.',
    defaultValue: 'true',
  },
  {
    key: 'SABCRM_SESSION_TTL_MINUTES',
    hint: 'Idle timeout for an authenticated CRM session.',
    defaultValue: '720',
  },
];

const AI_PROVIDERS: { id: string; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google (Gemini)' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'azure-openai', label: 'Azure OpenAI' },
];

// ---------------------------------------------------------------------------
// Health probe
//
// Best-effort, browser-side liveness check. There is no CRM health endpoint
// exposed to the browser, so this almost always resolves to "unknown" — which
// is the honest answer. A `same-origin` probe of an internal route is attempted
// and any failure is treated as "we can't tell from here", NOT as "down".
// ---------------------------------------------------------------------------

type ProbeStatus = 'checking' | 'ok' | 'off' | 'unknown';

interface HealthRow {
  id: string;
  name: string;
  sub: string;
  status: ProbeStatus;
}

const STATUS_LABEL: Record<ProbeStatus, string> = {
  checking: 'Checking…',
  ok: 'Reachable',
  off: 'Offline',
  unknown: 'Unknown',
};

/**
 * Attempts a short, abortable same-origin probe. Resolves 'ok' only on a real
 * response; network/abort/error all resolve 'unknown' (we genuinely cannot tell
 * from the browser). Never throws.
 */
async function probe(path: string, timeoutMs = 3500): Promise<ProbeStatus> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return 'unknown';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'same-origin',
    });
    // A 5xx is a genuine "down"; anything that responds at all means the
    // app server is up. Auth redirects / 404s still prove reachability.
    if (res.status >= 500) return 'off';
    return 'ok';
  } catch {
    return 'unknown';
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Honest callout
// ---------------------------------------------------------------------------

function HonestNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="st-admin-honest">
      <Info className="st-admin-honest__icon" size={14} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: ProbeStatus }): React.JSX.Element {
  return (
    <span className={`st-admin-status st-admin-status--${status}`}>
      <span className="st-admin-status__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: Health
// ---------------------------------------------------------------------------

function HealthSection(): React.JSX.Element {
  const [rows, setRows] = React.useState<HealthRow[]>([
    {
      id: 'app',
      name: 'SabNode app server',
      sub: 'The Next.js host serving this dashboard.',
      status: 'checking',
    },
    {
      id: 'engine',
      name: 'SabCRM engine',
      sub: 'Rust record/metadata engine behind the server actions.',
      status: 'checking',
    },
    {
      id: 'mongo',
      name: 'Primary datastore (Mongo)',
      sub: 'Not probeable from the browser — reported via the engine only.',
      status: 'checking',
    },
  ]);
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  const runChecks = React.useCallback(async () => {
    setRunning(true);
    setRows((prev) => prev.map((r) => ({ ...r, status: 'checking' as ProbeStatus })));

    // App server: probing the current origin proves the Next.js host is up.
    const appStatus = await probe(
      typeof window !== 'undefined' ? window.location.pathname : '/',
    );

    // Engine + Mongo aren't directly reachable from the browser. We don't have
    // a public health route, so we're honest: "unknown" rather than fabricated.
    const engineStatus: ProbeStatus = 'unknown';
    const mongoStatus: ProbeStatus = 'unknown';

    setRows([
      {
        id: 'app',
        name: 'SabNode app server',
        sub: 'The Next.js host serving this dashboard.',
        status: appStatus,
      },
      {
        id: 'engine',
        name: 'SabCRM engine',
        sub: 'No browser-facing health route yet — status can only be confirmed server-side.',
        status: engineStatus,
      },
      {
        id: 'mongo',
        name: 'Primary datastore (Mongo)',
        sub: 'Not probeable from the browser — reported via the engine only.',
        status: mongoStatus,
      },
    ]);
    setCheckedAt(new Date().toLocaleTimeString());
    setRunning(false);
  }, []);

  React.useEffect(() => {
    void runChecks();
  }, [runChecks]);

  return (
    <section className="st-admin-section">
      <div className="st-admin-section__head">
        <h2 className="st-admin-section__title">
          <Activity size={16} aria-hidden="true" />
          Health
        </h2>
        <TwentyButton
          variant="secondary"
          icon={RefreshCw}
          onClick={() => void runChecks()}
          disabled={running}
        >
          {running ? 'Checking…' : 'Re-check'}
        </TwentyButton>
      </div>
      <p className="st-admin-section__desc">
        Best-effort liveness for the services behind SabCRM. Only the app server
        can be probed from your browser; the engine and datastore report{' '}
        <strong>Unknown</strong> until a server-side health route is wired up —
        an honest result, not an outage.
      </p>

      <div className="st-admin-health">
        {rows.map((row) => (
          <div key={row.id} className="st-admin-health__row">
            <div className="st-admin-health__main">
              <span className="st-admin-health__name">{row.name}</span>
              <span className="st-admin-health__sub">{row.sub}</span>
            </div>
            <StatusPill status={row.status} />
          </div>
        ))}
      </div>

      {checkedAt ? (
        <p className="st-footnote">Last checked at {checkedAt}.</p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Config variables
// ---------------------------------------------------------------------------

interface ConfigSectionProps {
  overrides: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function ConfigSection({ overrides, onChange }: ConfigSectionProps): React.JSX.Element {
  return (
    <section className="st-admin-section">
      <div className="st-admin-section__head">
        <h2 className="st-admin-section__title">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Config variables
        </h2>
      </div>
      <p className="st-admin-section__desc">
        CRM configuration keys for reference. The authoritative values are set
        server-side and aren&apos;t readable from the browser — edits here are{' '}
        <strong>local overrides only</strong>.
      </p>

      <HonestNote>
        Values you type are saved to this browser&apos;s <code>localStorage</code>{' '}
        and are never sent to the server. They do not change the running
        configuration; they exist to draft/annotate values before applying them
        through your real deployment tooling.
      </HonestNote>

      <div className="st-admin-config">
        {CONFIG_KEYS.map((cfg) => {
          const overridden = Object.prototype.hasOwnProperty.call(overrides, cfg.key);
          const value = overridden ? overrides[cfg.key]! : cfg.defaultValue;
          return (
            <div key={cfg.key} className="st-admin-config__row">
              <div className="st-admin-config__key">
                <span className="st-admin-config__name">
                  {cfg.key}
                  <span className="st-admin-config__source">
                    {overridden ? '(local override)' : '(reference default)'}
                  </span>
                </span>
                <span className="st-admin-config__hint">{cfg.hint}</span>
              </div>
              <input
                className="st-admin-input st-admin-input--mono"
                type="text"
                value={value}
                spellCheck={false}
                onChange={(e) => onChange(cfg.key, e.target.value)}
                aria-label={`${cfg.key} value`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Signing keys (stubbed placeholder)
// ---------------------------------------------------------------------------

function SigningKeysSection(): React.JSX.Element {
  const [notice, setNotice] = React.useState<string | null>(null);

  return (
    <section className="st-admin-section">
      <div className="st-admin-section__head">
        <h2 className="st-admin-section__title">
          <KeyRound size={16} aria-hidden="true" />
          Signing keys
        </h2>
      </div>
      <p className="st-admin-section__desc">
        Keys used to sign tokens and webhook payloads issued by the CRM engine.
      </p>

      <HonestNote>
        Key management isn&apos;t wired up in SabCRM yet. This is a placeholder —
        no key material is shown, generated, or rotated here. The control below
        is a stub that confirms the action isn&apos;t backed by a real endpoint.
      </HonestNote>

      <div className="st-admin-keycard">
        <div className="st-admin-keycard__row">
          <span className="st-admin-keycard__id">primary-signing-key</span>
          <span className="st-chip st-chip--off">
            <span className="st-chip__dot" aria-hidden="true" />
            <span className="st-chip__label">Not provisioned</span>
          </span>
        </div>
        <span className="st-admin-keycard__meta">
          No active signing key is managed from this panel. When key rotation is
          implemented, the current key id, algorithm, and rotation history will
          appear here.
        </span>
      </div>

      <div className="st-admin-actions">
        <TwentyButton
          variant="secondary"
          icon={RefreshCw}
          onClick={() =>
            setNotice(
              'Key rotation is not wired up. No endpoint was called and no key was changed.',
            )
          }
        >
          Rotate keys
        </TwentyButton>
        {notice ? (
          <span className="st-form-error" role="status">
            {notice}
          </span>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: AI providers
// ---------------------------------------------------------------------------

interface AiSectionProps {
  provider: string;
  apiKey: string;
  onSave: (provider: string, apiKey: string) => void;
}

function AiProvidersSection({ provider, apiKey, onSave }: AiSectionProps): React.JSX.Element {
  const [draftProvider, setDraftProvider] = React.useState(provider);
  const [draftKey, setDraftKey] = React.useState(apiKey);
  const [saved, setSaved] = React.useState(false);

  // Keep drafts in sync if the hydrated values arrive after first render.
  React.useEffect(() => {
    setDraftProvider(provider);
    setDraftKey(apiKey);
  }, [provider, apiKey]);

  const dirty = draftProvider !== provider || draftKey !== apiKey;

  const handleSave = React.useCallback(() => {
    onSave(draftProvider, draftKey.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }, [draftProvider, draftKey, onSave]);

  return (
    <section className="st-admin-section">
      <div className="st-admin-section__head">
        <h2 className="st-admin-section__title">
          <Sparkles size={16} aria-hidden="true" />
          AI providers
        </h2>
      </div>
      <p className="st-admin-section__desc">
        Choose the AI provider and key SabCRM&apos;s assistive features would use.
      </p>

      <HonestNote>
        This is stored in this browser&apos;s <code>localStorage</code> only — the
        key is <strong>not</strong> transmitted, validated, or used to make any
        request from this page. Wire it into a server-side secret before relying
        on it.
      </HonestNote>

      <div className="st-admin-field">
        <label className="st-admin-field__label" htmlFor="ai-provider">
          Provider
        </label>
        <select
          id="ai-provider"
          className="st-admin-select"
          value={draftProvider}
          onChange={(e) => setDraftProvider(e.target.value)}
        >
          {AI_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="st-admin-field">
        <label className="st-admin-field__label" htmlFor="ai-key">
          API key
        </label>
        <input
          id="ai-key"
          className="st-admin-input st-admin-input--mono"
          type="password"
          value={draftKey}
          spellCheck={false}
          autoComplete="off"
          placeholder="sk-…"
          onChange={(e) => setDraftKey(e.target.value)}
        />
      </div>

      <div className="st-admin-actions">
        <TwentyButton
          variant="primary"
          icon={saved ? Check : Save}
          onClick={handleSave}
          disabled={!dirty && !saved}
        >
          {saved ? 'Saved locally' : 'Save'}
        </TwentyButton>
        {saved ? (
          <span className="st-admin-saved" role="status">
            Stored in this browser only.
          </span>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAdminPanelPage(): React.JSX.Element {
  const [tab, setTab] = React.useState<TabId>('health');
  const [state, setState] = React.useState<AdminLocalState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate local state after mount so SSR and first client render agree.
  React.useEffect(() => {
    const stored = readStored();
    setState({
      config: { ...DEFAULT_STATE.config, ...(stored.config ?? {}) },
      aiProvider: stored.aiProvider ?? DEFAULT_STATE.aiProvider,
      aiApiKey: stored.aiApiKey ?? DEFAULT_STATE.aiApiKey,
    });
    setHydrated(true);
  }, []);

  const persist = React.useCallback((next: AdminLocalState) => {
    writeStored(next);
    setState(next);
  }, []);

  const handleConfigChange = React.useCallback(
    (key: string, value: string) => {
      setState((prev) => {
        const next: AdminLocalState = {
          ...prev,
          config: { ...prev.config, [key]: value },
        };
        writeStored(next);
        return next;
      });
    },
    [],
  );

  const handleAiSave = React.useCallback(
    (provider: string, apiKey: string) => {
      persist({ ...state, aiProvider: provider, aiApiKey: apiKey });
    },
    [persist, state],
  );

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Admin Panel" icon={ShieldAlert} />
        <p className="st-settings__intro">
          Operator-level controls for this SabCRM workspace — service health,
          configuration reference, signing keys, and AI providers. Several areas
          aren&apos;t backed by a server yet; each one says so plainly rather than
          implying a wiring that doesn&apos;t exist.
        </p>

        <div className="st-admin-tabs" role="tablist" aria-label="Admin panel sections">
          {TABS.map((t) => {
            const { Icon } = t;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`st-admin-tab${active ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={14} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'health' ? <HealthSection /> : null}

        {tab === 'config' ? (
          <ConfigSection overrides={state.config} onChange={handleConfigChange} />
        ) : null}

        {tab === 'keys' ? <SigningKeysSection /> : null}

        {tab === 'ai' ? (
          hydrated ? (
            <AiProvidersSection
              provider={state.aiProvider}
              apiKey={state.aiApiKey}
              onSave={handleAiSave}
            />
          ) : (
            <section className="st-admin-section">
              <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
                <div className="st-skeleton st-skeleton-row" />
                <div className="st-skeleton st-skeleton-row" />
              </div>
            </section>
          )
        ) : null}
      </div>
    </div>
  );
}
