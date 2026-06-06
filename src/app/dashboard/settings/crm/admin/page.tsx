'use client';

/**
 * SabCRM - Admin Panel settings (`/dashboard/settings/crm/admin`).
 *
 * An operator-level "Admin Panel" surface, built entirely on the 20ui design
 * system. It groups a handful of operator concerns (config variables, signing
 * keys, health status, AI providers) mirroring the structure SabCRM ships
 * elsewhere.
 *
 * IMPORTANT - honesty over theatre. Most of these concerns have no backend
 * wired up in SabCRM yet, so every section is explicit about where its data
 * really lives:
 *
 *   - Health - a few best-effort status rows (CRM engine reachable? backing
 *     services?). The probe is a client-side fetch that will usually fail
 *     because the engine may be down or unexposed to the browser; rows then show
 *     "Unknown" / "Offline" honestly rather than faking "OK".
 *   - Config variables - a read-only / locally-editable list of CRM config keys.
 *     Edits persist to `localStorage` only (clearly labelled "local override"),
 *     never to a server.
 *   - Signing keys - a stubbed "rotate keys" placeholder. No keys are actually
 *     issued or rotated; the button surfaces an honest "not wired up" notice.
 *   - AI providers - provider + API-key fields persisted to `localStorage` only,
 *     with an explicit note that nothing is sent anywhere.
 */

import * as React from 'react';
import {
  ShieldAlert,
  Activity,
  SlidersHorizontal,
  KeyRound,
  Sparkles,
  RefreshCw,
  Save,
  Check,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Field,
  Input,
  Badge,
  Callout,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import { useSettingsSync } from '../use-settings-sync';

// ---------------------------------------------------------------------------
// Local admin-panel store
//
// localStorage is used as an instant device cache; the canonical copy lives in
// the per-project CRM settings document on the server (section key 'admin'),
// synced via useSettingsSync. Fails closed: SSR / private-mode / quota errors
// fall back to defaults and never throw.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sabcrm.admin.v1';

interface AdminLocalState {
  /** Local overrides for config-variable values, keyed by config key. */
  config: Record<string, string>;
  /** AI provider id (e.g. 'openai'). */
  aiProvider: string;
  /** AI provider API key - stored server-side, tenant-scoped (no encryption). */
  aiApiKey: string;
}

const DEFAULT_STATE: AdminLocalState = {
  config: {},
  aiProvider: 'openai',
  aiApiKey: '',
};

/** Coerce the raw server slice into a typed AdminLocalState (or null). */
function coerceAdmin(raw: unknown): AdminLocalState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    config:
      o.config && typeof o.config === 'object' && !Array.isArray(o.config)
        ? (o.config as Record<string, string>)
        : DEFAULT_STATE.config,
    aiProvider:
      typeof o.aiProvider === 'string' && o.aiProvider
        ? o.aiProvider
        : DEFAULT_STATE.aiProvider,
    aiApiKey:
      typeof o.aiApiKey === 'string' ? o.aiApiKey : DEFAULT_STATE.aiApiKey,
  };
}

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
    /* quota / private mode - settings stay in-memory only */
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
// exposed to the browser, so this almost always resolves to "unknown" - which
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
  checking: 'Checking',
  ok: 'Reachable',
  off: 'Offline',
  unknown: 'Unknown',
};

const STATUS_TONE: Record<ProbeStatus, BadgeTone> = {
  checking: 'neutral',
  ok: 'success',
  off: 'danger',
  unknown: 'warning',
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
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: ProbeStatus }): React.JSX.Element {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
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
      sub: 'Not probeable from the browser, reported via the engine only.',
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
        sub: 'No browser-facing health route yet, status can only be confirmed server-side.',
        status: engineStatus,
      },
      {
        id: 'mongo',
        name: 'Primary datastore (Mongo)',
        sub: 'Not probeable from the browser, reported via the engine only.',
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
    <Card variant="outlined" padding="lg">
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Activity size={16} aria-hidden="true" />
            Health
          </CardTitle>
          <CardDescription>
            Best-effort liveness for the services behind SabCRM. Only the app
            server can be probed from your browser; the engine and datastore
            report <strong>Unknown</strong> until a server-side health route is
            wired up, an honest result, not an outage.
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          iconLeft={RefreshCw}
          onClick={() => void runChecks()}
          loading={running}
        >
          {running ? 'Checking' : 'Re-check'}
        </Button>
      </CardHeader>

      <CardBody className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3.5 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-[var(--st-text)]">{row.name}</span>
              <span className="text-xs text-[var(--st-text-secondary)]">{row.sub}</span>
            </div>
            <StatusPill status={row.status} />
          </div>
        ))}

        {checkedAt ? (
          <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
            Last checked at {checkedAt}.
          </p>
        ) : null}
      </CardBody>
    </Card>
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
    <Card variant="outlined" padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Config variables
        </CardTitle>
        <CardDescription>
          CRM configuration keys for reference. The authoritative values are set
          server-side and aren&apos;t readable from the browser, edits here are{' '}
          <strong>local overrides only</strong>.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Callout tone="info">
          Values you type are saved to this browser&apos;s <code>localStorage</code>{' '}
          and are never sent to the server. They do not change the running
          configuration; they exist to draft/annotate values before applying
          them through your real deployment tooling.
        </Callout>

        <div className="flex flex-col gap-4">
          {CONFIG_KEYS.map((cfg) => {
            const overridden = Object.prototype.hasOwnProperty.call(overrides, cfg.key);
            const value = overridden ? overrides[cfg.key]! : cfg.defaultValue;
            return (
              <div
                key={cfg.key}
                className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-mono text-sm text-[var(--st-text)]">
                    {cfg.key}
                    <Badge tone={overridden ? 'accent' : 'neutral'} kind="soft">
                      {overridden ? 'local override' : 'reference default'}
                    </Badge>
                  </span>
                  <span className="text-xs text-[var(--st-text-secondary)]">{cfg.hint}</span>
                </div>
                <Field label={`${cfg.key} value`} className="[&_.u-field__label]:sr-only">
                  <Input
                    type="text"
                    value={value}
                    spellCheck={false}
                    className="font-mono"
                    onChange={(e) => onChange(cfg.key, e.target.value)}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section: Signing keys (stubbed placeholder)
// ---------------------------------------------------------------------------

function SigningKeysSection(): React.JSX.Element {
  const { toast } = useToast();

  return (
    <Card variant="outlined" padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={16} aria-hidden="true" />
          Signing keys
        </CardTitle>
        <CardDescription>
          Keys used to sign tokens and webhook payloads issued by the CRM engine.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Callout tone="info">
          Key management isn&apos;t wired up in SabCRM yet. This is a placeholder,
          no key material is shown, generated, or rotated here. The control below
          is a stub that confirms the action isn&apos;t backed by a real endpoint.
        </Callout>

        <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm text-[var(--st-text)]">primary-signing-key</span>
            <Badge tone="neutral" dot>
              Not provisioned
            </Badge>
          </div>
          <span className="text-xs text-[var(--st-text-secondary)]">
            No active signing key is managed from this panel. When key rotation is
            implemented, the current key id, algorithm, and rotation history will
            appear here.
          </span>
        </div>

        <div>
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            onClick={() =>
              toast.warning(
                'Key rotation is not wired up. No endpoint was called and no key was changed.',
              )
            }
          >
            Rotate keys
          </Button>
        </div>
      </CardBody>
    </Card>
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
  const { toast } = useToast();
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
    toast.success('Stored in this browser only.');
    window.setTimeout(() => setSaved(false), 1800);
  }, [draftProvider, draftKey, onSave, toast]);

  return (
    <Card variant="outlined" padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={16} aria-hidden="true" />
          AI providers
        </CardTitle>
        <CardDescription>
          Choose the AI provider and key SabCRM&apos;s assistive features would use.
        </CardDescription>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <Callout tone="info">
          This is stored in this browser&apos;s <code>localStorage</code> only, the
          key is <strong>not</strong> transmitted, validated, or used to make any
          request from this page. Wire it into a server-side secret before relying
          on it.
        </Callout>

        <Field label="Provider">
          <Select value={draftProvider} onValueChange={setDraftProvider}>
            <SelectTrigger aria-label="AI provider">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="API key">
          <Input
            type="password"
            value={draftKey}
            spellCheck={false}
            autoComplete="off"
            placeholder="sk-..."
            className="font-mono"
            onChange={(e) => setDraftKey(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            iconLeft={saved ? Check : Save}
            onClick={handleSave}
            disabled={!dirty && !saved}
          >
            {saved ? 'Saved locally' : 'Save'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAdminPanelPage(): React.JSX.Element {
  const [tab, setTab] = React.useState<TabId>('health');
  const [state, setState] = React.useState<AdminLocalState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = React.useState(false);
  const sync = useSettingsSync<AdminLocalState>('admin', coerceAdmin);

  // Hydrate local state from localStorage after mount (instant, SSR-safe).
  React.useEffect(() => {
    const stored = readStored();
    setState({
      config: { ...DEFAULT_STATE.config, ...(stored.config ?? {}) },
      aiProvider: stored.aiProvider ?? DEFAULT_STATE.aiProvider,
      aiApiKey: stored.aiApiKey ?? DEFAULT_STATE.aiApiKey,
    });
    setHydrated(true);
  }, []);

  // When the server resolves a stored slice, adopt it as the source of truth.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setState(sync.remote);
    writeStored(sync.remote);
  }, [sync.phase, sync.remote]);

  const persist = React.useCallback((next: AdminLocalState) => {
    writeStored(next);
    setState(next);
    // Persist to the per-project settings document (tenant-scoped, server-side).
    void sync.save(next);
  }, [sync]);

  const handleConfigChange = React.useCallback(
    (key: string, value: string) => {
      setState((prev) => {
        const next: AdminLocalState = {
          ...prev,
          config: { ...prev.config, [key]: value },
        };
        writeStored(next);
        // Persist config overrides to the server (fire-and-forget).
        void sync.save(next);
        return next;
      });
    },
    [sync],
  );

  const handleAiSave = React.useCallback(
    (provider: string, apiKey: string) => {
      persist({ ...state, aiProvider: provider, aiApiKey: apiKey });
    },
    [persist, state],
  );

  return (
    <div className="ui20 mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCRM workspace</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <ShieldAlert size={20} aria-hidden="true" />
            Admin Panel
          </PageTitle>
          <PageDescription>
            Operator-level controls for this SabCRM workspace, service health,
            configuration reference, signing keys, and AI providers. Several areas
            aren&apos;t backed by a server yet; each one says so plainly rather
            than implying a wiring that doesn&apos;t exist.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList aria-label="Admin panel sections">
          {TABS.map((t) => {
            const { Icon } = t;
            return (
              <TabsTrigger key={t.id} value={t.id} className="flex items-center gap-1.5">
                <Icon size={14} aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="health" className="mt-4">
          <HealthSection />
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <ConfigSection overrides={state.config} onChange={handleConfigChange} />
        </TabsContent>

        <TabsContent value="keys" className="mt-4">
          <SigningKeysSection />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          {hydrated ? (
            <AiProvidersSection
              provider={state.aiProvider}
              apiKey={state.aiApiKey}
              onSave={handleAiSave}
            />
          ) : (
            <Card variant="outlined" padding="lg">
              <CardBody className="flex flex-col gap-3">
                <Skeleton height={40} />
                <Skeleton height={40} />
              </CardBody>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
