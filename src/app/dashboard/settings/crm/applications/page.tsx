'use client';

/**
 * SabCRM - Applications settings (`/dashboard/settings/crm/applications`).
 *
 * The apps and integrations marketplace surface, ported to SabNode with an
 * honest accounting of what is actually wired up today, rebuilt on the 20ui
 * design system.
 *
 *   1. Marketplace - a responsive grid of integration cards (Slack, Zapier,
 *      Google Workspace, Webhooks, REST API, Logic Functions and more). Each
 *      card shows an icon, a one-line description, an availability badge, and an
 *      action. Where a real settings surface already exists (Webhooks, REST API,
 *      Logic Functions, Workflows) the action is a "Configure" link to that
 *      page. Everything else honestly reads "Coming soon" and opens a read-only
 *      detail dialog. SabCRM has no marketplace install engine yet, so we do not
 *      pretend it connects.
 *
 *   2. Installed - a localStorage-backed list of placeholder installed apps. You
 *      can add a named placeholder and remove it; it persists per browser under
 *      a single key. A clearly labelled note explains these are local
 *      placeholders and that real installation needs the (not-yet-built)
 *      application engine.
 *
 *   3. Developer - links to the developer surfaces that DO exist today (API
 *      keys, webhooks, logic functions).
 *
 * This page is intentionally engine-free: it is pure client UI over existing
 * routes plus localStorage, with graceful empty and unavailable states
 * throughout. Pure 20ui: no Ui20, no Twenty, no raw control elements.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Blocks,
  Webhook,
  KeyRound,
  Zap,
  MessageSquare,
  Mail,
  Calendar,
  Code2,
  Workflow,
  Plug,
  Plus,
  Trash2,
  Info,
  PackageOpen,
  Download,
  ShieldCheck,
  Eye,
  Pencil,
  Database,
  Send,
  Lock,
} from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Badge,
  Callout,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  useToast,
} from '@/components/sabcrm/20ui';

import { useSettingsSync } from '../use-settings-sync';

// ---------------------------------------------------------------------------
// Marketplace catalogue
//
// `href` present  -> a real existing SabCRM settings surface; card shows
//                   "Configure" and links there.
// `href` absent   -> not wired up; card shows a disabled "Coming soon".
// ---------------------------------------------------------------------------

/**
 * A single permission/scope an app declares.
 *
 * Mirrors Twenty's application "Permissions" tab, where each installed app
 * exposes the object/field access and capabilities it requests. SabCRM has no
 * install engine, so these are statically declared per catalogue entry and
 * shown read-only in the app detail dialog.
 */
interface AppScope {
  id: string;
  label: string;
  description: string;
  /** Short access qualifier shown on the right (e.g. "Read", "Read & write"). */
  access: string;
  Icon: React.ElementType;
}

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  Icon: React.ElementType;
  /** Existing settings route, when one exists. */
  href?: string;
  /** Permissions/scopes this app requests - surfaced in the detail dialog. */
  scopes: AppScope[];
}

// Re-usable scope presets so the catalogue stays terse.
const SCOPE_READ_RECORDS: AppScope = {
  id: 'read-records',
  label: 'Read records',
  description: 'View people, companies, opportunities and other CRM records.',
  access: 'Read',
  Icon: Eye,
};
const SCOPE_WRITE_RECORDS: AppScope = {
  id: 'write-records',
  label: 'Create & update records',
  description: 'Create new records and update existing ones on your behalf.',
  access: 'Read & write',
  Icon: Pencil,
};
const SCOPE_ACTIVITIES: AppScope = {
  id: 'activities',
  label: 'Activities & timeline',
  description: 'Read and post notes, tasks and timeline events on records.',
  access: 'Read & write',
  Icon: Send,
};
const SCOPE_METADATA: AppScope = {
  id: 'metadata',
  label: 'Workspace metadata',
  description: 'Read object and field definitions to map your data.',
  access: 'Read',
  Icon: Database,
};

const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: 'webhooks',
    name: 'Webhooks',
    description:
      'Push record events to any HTTPS endpoint and inspect delivery logs.',
    Icon: Webhook,
    href: '/dashboard/settings/crm/webhooks',
    scopes: [SCOPE_READ_RECORDS, SCOPE_METADATA],
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description:
      'Programmatic access with scoped API keys for your own integrations.',
    Icon: KeyRound,
    href: '/dashboard/settings/crm/api',
    scopes: [SCOPE_READ_RECORDS, SCOPE_WRITE_RECORDS, SCOPE_METADATA],
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description:
      'Automate multi-step processes that react to changes in your data.',
    Icon: Workflow,
    href: '/dashboard/settings/crm/automations',
    scopes: [SCOPE_READ_RECORDS, SCOPE_WRITE_RECORDS, SCOPE_ACTIVITIES],
  },
  {
    id: 'logic-functions',
    name: 'Logic Functions',
    description:
      'Run serverless functions as reusable steps inside your automations.',
    Icon: Code2,
    href: '/dashboard/settings/crm/functions',
    scopes: [SCOPE_READ_RECORDS, SCOPE_WRITE_RECORDS],
  },
  {
    id: 'slack',
    name: 'Slack',
    description:
      'Post record updates and alerts to channels, and act on them from Slack.',
    Icon: MessageSquare,
    scopes: [SCOPE_READ_RECORDS, SCOPE_ACTIVITIES],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description:
      'Connect SabCRM to thousands of apps with no-code triggers and actions.',
    Icon: Zap,
    scopes: [SCOPE_READ_RECORDS, SCOPE_WRITE_RECORDS, SCOPE_METADATA],
  },
  {
    id: 'google',
    name: 'Google Workspace',
    description:
      'Sync Gmail messages and Google Calendar events to your connected account.',
    Icon: Calendar,
    scopes: [SCOPE_READ_RECORDS, SCOPE_ACTIVITIES],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description:
      'Capture email conversations against the right people and companies.',
    Icon: Mail,
    scopes: [SCOPE_READ_RECORDS, SCOPE_ACTIVITIES],
  },
];

// ---------------------------------------------------------------------------
// Tabs (Marketplace / Installed / Developer)
// ---------------------------------------------------------------------------

type AppsTabId = 'marketplace' | 'installed' | 'developer';

const APPS_TABS: { id: AppsTabId; label: string; Icon: React.ElementType }[] = [
  { id: 'marketplace', label: 'Marketplace', Icon: Download },
  { id: 'installed', label: 'Installed', Icon: Blocks },
  { id: 'developer', label: 'Developer', Icon: Code2 },
];

// ---------------------------------------------------------------------------
// Installed apps - localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sabcrm.applications.installed.v1';

interface InstalledApp {
  id: string;
  name: string;
  installedAt: string;
}

/** Reads the installed list from localStorage, tolerating any malformed data. */
function readInstalled(): InstalledApp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is InstalledApp =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as InstalledApp).id === 'string' &&
        typeof (x as InstalledApp).name === 'string' &&
        typeof (x as InstalledApp).installedAt === 'string',
    );
  } catch {
    return [];
  }
}

/** Persists the installed list, swallowing quota / serialization failures. */
function writeInstalled(apps: InstalledApp[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch {
    /* storage unavailable (private mode / quota) - non-fatal */
  }
}

/** Coerce a raw server slice into a clean InstalledApp array (or null). */
function coerceInstalledApps(raw: unknown): InstalledApp[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(
    (x): x is InstalledApp =>
      !!x &&
      typeof x === 'object' &&
      typeof (x as InstalledApp).id === 'string' &&
      typeof (x as InstalledApp).name === 'string' &&
      typeof (x as InstalledApp).installedAt === 'string',
  );
}

/** Formats an ISO timestamp into a short, locale-aware label; falls back to raw. */
function formatInstalledAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Date(t).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return new Date(t).toISOString();
  }
}

// ---------------------------------------------------------------------------
// Marketplace card
// ---------------------------------------------------------------------------

function MarketplaceCard({
  app,
  onOpen,
}: {
  app: MarketplaceApp;
  onOpen: (app: MarketplaceApp) => void;
}): React.JSX.Element {
  const { Icon } = app;
  const available = Boolean(app.href);
  return (
    <Card variant="outlined" className="flex flex-col">
      <CardBody className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-[var(--st-text)]">
            {app.name}
          </span>
          <p className="mt-1 text-xs leading-relaxed text-[var(--st-text-secondary)]">
            {app.description}
          </p>
        </div>
      </CardBody>
      <CardFooter className="flex items-center justify-between gap-2">
        {available ? (
          <Badge tone="success" dot>
            Available
          </Badge>
        ) : (
          <Badge tone="neutral" dot>
            Coming soon
          </Badge>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpen(app)}
            title={`View ${app.name} details`}
          >
            Details
          </Button>
          {available && app.href ? (
            <Link href={app.href} aria-label={`Configure ${app.name}`}>
              <Button variant="secondary" size="sm" iconLeft={Plug}>
                Configure
              </Button>
            </Link>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// App detail dialog - application detail (About + Permissions/Scopes)
// ---------------------------------------------------------------------------

function AppDetailDialog({
  app,
  onClose,
}: {
  app: MarketplaceApp | null;
  onClose: () => void;
}): React.JSX.Element {
  const available = Boolean(app?.href);

  const footer = app ? (
    <>
      {available && app.href ? (
        <Link href={app.href} aria-label={`Configure ${app.name}`}>
          <Button variant="primary" iconLeft={Plug}>
            Configure
          </Button>
        </Link>
      ) : (
        <Button variant="primary" disabled title="Not available yet">
          Install
        </Button>
      )}
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </>
  ) : null;

  return (
    <Modal
      open={Boolean(app)}
      onClose={onClose}
      title={app?.name ?? ''}
      description={available ? 'Available integration' : 'Coming soon'}
      footer={footer}
    >
      {app ? (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              <Info size={12} aria-hidden="true" />
              About
            </h3>
            <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
              {app.description}
            </p>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              <ShieldCheck size={12} aria-hidden="true" />
              Permissions & scopes
            </h3>
            {app.scopes.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
                This app does not request any data access.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {app.scopes.map((scope) => {
                  const { Icon: ScopeIcon } = scope;
                  return (
                    <div
                      className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
                      key={scope.id}
                    >
                      <ScopeIcon
                        className="mt-0.5 shrink-0 text-[var(--st-text-tertiary)]"
                        size={15}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[var(--st-text)]">
                          {scope.label}
                        </span>
                        <span className="block text-xs text-[var(--st-text-secondary)]">
                          {scope.description}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-[var(--st-text-tertiary)]">
                        {scope.access}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {!available ? (
            <Callout tone="warning" icon={Lock}>
              This integration is not connectable yet. The marketplace install
              engine has not shipped. The scopes above are what it will request
              once available.
            </Callout>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Section heading helper
// ---------------------------------------------------------------------------

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--st-text)]">
      <span
        className="flex size-6 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
        aria-hidden="true"
      >
        <Icon size={15} />
      </span>
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Installed section
// ---------------------------------------------------------------------------

interface InstalledSectionProps {
  apps: InstalledApp[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

function InstalledSection({
  apps,
  onAdd,
  onRemove,
}: InstalledSectionProps): React.JSX.Element {
  const [name, setName] = React.useState('');

  const submit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;
      onAdd(trimmed);
      setName('');
    },
    [name, onAdd],
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading icon={PackageOpen}>Installed</SectionHeading>
      <p className="text-sm text-[var(--st-text-secondary)]">
        Apps you have added to this workspace.
      </p>

      <Callout tone="info" icon={Info}>
        These are local placeholders stored only in this browser. Real
        installation needs the application engine, which is not wired up yet.
        Use this to sketch out which integrations you plan to run.
      </Callout>

      <form className="flex items-end gap-2" onSubmit={submit}>
        <Field label="Placeholder app name" className="flex-1">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name a placeholder app (e.g. Internal Billing Sync)"
            maxLength={80}
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          iconLeft={Plus}
          disabled={name.trim().length === 0}
        >
          Add
        </Button>
      </form>

      {apps.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No apps installed"
          description="Add a placeholder above, or connect an integration from the marketplace."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr>
                <Th>App</Th>
                <Th>Added</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {apps.map((app) => (
                <Tr key={app.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--st-text)]">
                        {app.name}
                      </span>
                      <span className="text-xs text-[var(--st-text-tertiary)]">
                        Placeholder app
                      </span>
                    </div>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)]">
                    {formatInstalledAt(app.installedAt)}
                  </Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      className="text-[var(--st-danger)]"
                      onClick={() => onRemove(app.id)}
                      title="Remove placeholder app"
                    >
                      Remove
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Developer section - links to the developer surfaces that DO exist:
// API keys, webhooks and logic functions. SabCRM has no application-registration
// engine, so we are honest about that.
// ---------------------------------------------------------------------------

const DEVELOPER_LINKS: {
  id: string;
  name: string;
  description: string;
  href: string;
  Icon: React.ElementType;
}[] = [
  {
    id: 'api-keys',
    name: 'API keys',
    description:
      'Create scoped keys to authenticate your own integrations against the REST API.',
    href: '/dashboard/settings/crm/api',
    Icon: KeyRound,
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description:
      'Subscribe an HTTPS endpoint to record events and inspect delivery logs.',
    href: '/dashboard/settings/crm/webhooks',
    Icon: Webhook,
  },
  {
    id: 'functions',
    name: 'Logic Functions',
    description:
      'Author serverless functions to use as steps inside your automations.',
    href: '/dashboard/settings/crm/functions',
    Icon: Code2,
  },
];

function DeveloperSection(): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading icon={Code2}>Developer</SectionHeading>
      <p className="text-sm text-[var(--st-text-secondary)]">
        Build your own integrations against SabCRM. Registering full marketplace
        apps is not available yet, but these developer surfaces are live.
      </p>

      <Callout tone="info" icon={Info}>
        Custom application registration (manifests, OAuth clients, scoped
        install) needs the application engine, which is not wired up yet.
      </Callout>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEVELOPER_LINKS.map((link) => {
          const { Icon } = link;
          return (
            <Card key={link.id} variant="outlined" className="flex flex-col">
              <CardBody className="flex items-start gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--st-text)]">
                    {link.name}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--st-text-secondary)]">
                    {link.description}
                  </p>
                </div>
              </CardBody>
              <CardFooter className="flex items-center justify-between gap-2">
                <Badge tone="success" dot>
                  Available
                </Badge>
                <Link href={link.href} aria-label={`Open ${link.name}`}>
                  <Button variant="secondary" size="sm" iconLeft={Plug}>
                    Open
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmApplicationsSettingsPage(): React.JSX.Element {
  const { toast } = useToast();

  // Hydrate from localStorage after mount to keep SSR output deterministic.
  const [installed, setInstalled] = React.useState<InstalledApp[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const sync = useSettingsSync<InstalledApp[]>('installedApps', coerceInstalledApps);

  React.useEffect(() => {
    setInstalled(readInstalled());
    setHydrated(true);
  }, []);

  // When the server resolves a stored list, adopt it as the source of truth.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    setInstalled(sync.remote);
    writeInstalled(sync.remote);
  }, [sync.phase, sync.remote]);

  const handleAdd = React.useCallback(
    (name: string) => {
      setInstalled((prev) => {
        const next: InstalledApp[] = [
          {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `app_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name,
            installedAt: new Date().toISOString(),
          },
          ...prev,
        ];
        writeInstalled(next);
        void sync.save(next);
        return next;
      });
      toast.success(`Added "${name}"`);
    },
    [sync, toast],
  );

  const handleRemove = React.useCallback(
    (id: string) => {
      setInstalled((prev) => {
        const next = prev.filter((a) => a.id !== id);
        writeInstalled(next);
        void sync.save(next);
        return next;
      });
      toast.success('Placeholder app removed');
    },
    [sync, toast],
  );

  // Active tab (Marketplace / Installed / Developer) + detail dialog.
  const [activeTab, setActiveTab] = React.useState<AppsTabId>('marketplace');
  const [detailApp, setDetailApp] = React.useState<MarketplaceApp | null>(null);

  const openDetail = React.useCallback(
    (app: MarketplaceApp) => setDetailApp(app),
    [],
  );
  const closeDetail = React.useCallback(() => setDetailApp(null), []);

  return (
    <div className="20ui mx-auto flex w-full max-w-5xl flex-col gap-6 p-[var(--st-space-6)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-2">
              <Blocks size={20} aria-hidden="true" />
              Applications
            </span>
          </PageTitle>
          <PageDescription>
            Connect SabCRM to the tools you already use. Some integrations link
            to an existing settings page; others are on the roadmap and read
            "Coming soon" until the marketplace engine ships.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AppsTabId)}
      >
        <TabsList aria-label="Applications">
          {APPS_TABS.map((tab) => {
            const { Icon } = tab;
            return (
              <TabsTrigger key={tab.id} value={tab.id}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={15} aria-hidden="true" />
                  {tab.label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ---- Marketplace tab ---- */}
        <TabsContent value="marketplace" className="flex flex-col gap-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            Browse available apps and integrations. Select a card to review the
            permissions it requests. "Available" cards open a working settings
            surface; the rest are coming soon.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETPLACE_APPS.map((app) => (
              <MarketplaceCard key={app.id} app={app} onOpen={openDetail} />
            ))}
          </div>
        </TabsContent>

        {/* ---- Installed tab ---- */}
        <TabsContent value="installed">
          {hydrated ? (
            <InstalledSection
              apps={installed}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ) : (
            <section className="flex flex-col gap-4">
              <SectionHeading icon={PackageOpen}>Installed</SectionHeading>
              <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-[var(--st-space-3)]">
                <Skeleton height={20} />
                <Skeleton height={20} />
              </div>
            </section>
          )}
        </TabsContent>

        {/* ---- Developer tab ---- */}
        <TabsContent value="developer">
          <DeveloperSection />
        </TabsContent>
      </Tabs>

      <AppDetailDialog app={detailApp} onClose={closeDetail} />
    </div>
  );
}
