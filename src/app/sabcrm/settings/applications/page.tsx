'use client';

/**
 * SabCRM — Applications settings (`/sabcrm/settings/applications`), Twenty-style.
 *
 * The Twenty "apps & integrations marketplace" surface, ported to SabNode with
 * an honest accounting of what is actually wired up today.
 *
 *   1. Marketplace — a responsive grid of integration cards (Slack, Zapier,
 *      Google Workspace, Webhooks, REST API, Logic Functions, …). Each card
 *      shows an icon, a one-line description, an availability chip, and an
 *      action. Where a real settings surface already exists (Webhooks → the
 *      webhooks page, REST API → the API page, Logic Functions → functions,
 *      Workflows → automations) the action is a "Configure" link to that page.
 *      Everything else honestly reads "Coming soon" and is disabled — SabCRM
 *      has no marketplace install engine yet, so we do not pretend it connects.
 *
 *   2. Installed — a localStorage-backed list of placeholder "installed apps".
 *      You can add a named placeholder and remove it; it persists per browser
 *      under a single key. A clearly-labelled note explains these are local
 *      placeholders and that real installation needs the (not-yet-built)
 *      application engine.
 *
 * This page is intentionally engine-free: it is pure client UI over existing
 * routes + localStorage, with graceful empty / unavailable states throughout.
 * Twenty look only — `.st-*` classes, no ZoruUI / Tailwind / clay.
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
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './applications.css';

// ---------------------------------------------------------------------------
// Marketplace catalogue
//
// `href` present  → a real existing SabCRM settings surface; card shows
//                   "Configure" and links there.
// `href` absent   → not wired up; card shows a disabled "Coming soon".
// ---------------------------------------------------------------------------

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  Icon: React.ElementType;
  /** Existing settings route, when one exists. */
  href?: string;
}

const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: 'webhooks',
    name: 'Webhooks',
    description:
      'Push record events to any HTTPS endpoint and inspect delivery logs.',
    Icon: Webhook,
    href: '/sabcrm/settings/webhooks',
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description:
      'Programmatic access with scoped API keys for your own integrations.',
    Icon: KeyRound,
    href: '/sabcrm/settings/api',
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description:
      'Automate multi-step processes that react to changes in your data.',
    Icon: Workflow,
    href: '/sabcrm/settings/automations',
  },
  {
    id: 'logic-functions',
    name: 'Logic Functions',
    description:
      'Run serverless functions as reusable steps inside your automations.',
    Icon: Code2,
    href: '/sabcrm/settings/functions',
  },
  {
    id: 'slack',
    name: 'Slack',
    description:
      'Post record updates and alerts to channels, and act on them from Slack.',
    Icon: MessageSquare,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description:
      'Connect SabCRM to thousands of apps with no-code triggers and actions.',
    Icon: Zap,
  },
  {
    id: 'google',
    name: 'Google Workspace',
    description:
      'Sync Gmail messages and Google Calendar events to your connected account.',
    Icon: Calendar,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description:
      'Capture email conversations against the right people and companies.',
    Icon: Mail,
  },
];

// ---------------------------------------------------------------------------
// Installed apps — localStorage persistence
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
    /* storage unavailable (private mode / quota) — non-fatal */
  }
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

function MarketplaceCard({ app }: { app: MarketplaceApp }): React.JSX.Element {
  const { Icon } = app;
  const available = Boolean(app.href);
  return (
    <article className="st-app-card">
      <div className="st-app-card__top">
        <span className="st-app-card__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="st-app-card__heading">
          <span className="st-app-card__name">{app.name}</span>
          <p className="st-app-card__desc">{app.description}</p>
        </div>
      </div>
      <div className="st-app-card__footer">
        {available ? (
          <span className="st-chip st-chip--available">
            <span className="st-chip__dot" aria-hidden="true" />
            <span className="st-chip__label">Available</span>
          </span>
        ) : (
          <span className="st-chip st-chip--soon">
            <span className="st-chip__dot" aria-hidden="true" />
            <span className="st-chip__label">Coming soon</span>
          </span>
        )}

        {available && app.href ? (
          <Link
            href={app.href}
            className="st-btn st-btn--secondary"
            aria-label={`Configure ${app.name}`}
          >
            <Plug size={14} aria-hidden="true" />
            Configure
          </Link>
        ) : (
          <TwentyButton variant="secondary" disabled title="Not available yet">
            Connect
          </TwentyButton>
        )}
      </div>
    </article>
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
    <section className="st-apps-section">
      <div className="st-apps-section__head">
        <h2 className="st-apps-section__title">
          <span className="st-apps-section__title-icon" aria-hidden="true">
            <PackageOpen size={15} />
          </span>
          Installed
        </h2>
      </div>
      <p className="st-apps-section__desc">
        Apps you&apos;ve added to this workspace.
      </p>

      <div className="st-apps-callout">
        <Info className="st-apps-callout__icon" size={14} aria-hidden="true" />
        <span>
          These are local placeholders stored only in this browser — real
          installation needs the application engine, which isn&apos;t wired up
          yet. Use this to sketch out which integrations you plan to run.
        </span>
      </div>

      <form className="st-installed-add" onSubmit={submit}>
        <input
          className="st-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name a placeholder app (e.g. Internal Billing Sync)"
          aria-label="Placeholder app name"
          maxLength={80}
        />
        <TwentyButton
          type="submit"
          variant="primary"
          icon={Plus}
          disabled={name.trim().length === 0}
        >
          Add
        </TwentyButton>
      </form>

      {apps.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <PackageOpen size={20} />
          </span>
          <h2 className="st-empty__title">No apps installed</h2>
          <p className="st-empty__desc">
            Add a placeholder above, or connect an integration from the
            marketplace.
          </p>
        </div>
      ) : (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>App</th>
                <th>Added</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="st-row">
                  <td>
                    <div className="st-installed__meta">
                      <span className="st-installed__name">{app.name}</span>
                      <span className="st-installed__time">
                        Placeholder app
                      </span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--st-text-secondary)' }}>
                    {formatInstalledAt(app.installedAt)}
                  </td>
                  <td className="st-cell-actions">
                    <TwentyButton
                      variant="ghost"
                      icon={Trash2}
                      className="st-btn--danger"
                      onClick={() => onRemove(app.id)}
                      title="Remove placeholder app"
                    >
                      Remove
                    </TwentyButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmApplicationsSettingsPage(): React.JSX.Element {
  // Hydrate from localStorage after mount to keep SSR output deterministic.
  const [installed, setInstalled] = React.useState<InstalledApp[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setInstalled(readInstalled());
    setHydrated(true);
  }, []);

  const handleAdd = React.useCallback((name: string) => {
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
      return next;
    });
  }, []);

  const handleRemove = React.useCallback((id: string) => {
    setInstalled((prev) => {
      const next = prev.filter((a) => a.id !== id);
      writeInstalled(next);
      return next;
    });
  }, []);

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Applications" icon={Blocks} />
        <p className="st-settings__intro">
          Connect SabCRM to the tools you already use. Some integrations link to
          an existing settings page; others are on the roadmap and read
          &ldquo;Coming soon&rdquo; until the marketplace engine ships.
        </p>

        {/* ---- Marketplace ---- */}
        <section className="st-apps-section" style={{ marginTop: 0 }}>
          <div className="st-apps-section__head">
            <h2 className="st-apps-section__title">
              <span className="st-apps-section__title-icon" aria-hidden="true">
                <Blocks size={15} />
              </span>
              Marketplace
            </h2>
          </div>
          <p className="st-apps-section__desc">
            Browse available apps and integrations. &ldquo;Available&rdquo; cards
            open a working settings surface; the rest are coming soon.
          </p>

          <div className="st-apps-grid">
            {MARKETPLACE_APPS.map((app) => (
              <MarketplaceCard key={app.id} app={app} />
            ))}
          </div>
        </section>

        {/* ---- Installed ---- */}
        {hydrated ? (
          <InstalledSection
            apps={installed}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        ) : (
          <section className="st-apps-section">
            <div className="st-apps-section__head">
              <h2 className="st-apps-section__title">
                <span
                  className="st-apps-section__title-icon"
                  aria-hidden="true"
                >
                  <PackageOpen size={15} />
                </span>
                Installed
              </h2>
            </div>
            <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
              <div className="st-skeleton st-skeleton-row" />
              <div className="st-skeleton st-skeleton-row" />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
