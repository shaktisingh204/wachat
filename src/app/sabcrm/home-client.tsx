'use client';

/**
 * SabCRM hub (`/sabcrm`) — the client surface.
 *
 * A live, data-driven entry page: it loads the workspace's real objects from
 * the data model (so custom objects + the renamed Leads show up, and the stale
 * `opportunities` slug is hidden) and a record count per object, then renders a
 * polished card grid + quick actions. Everything fails closed to a sensible
 * empty/skeleton state so the page always renders inside the `.sabcrm-twenty`
 * frame.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Target,
  StickyNote,
  CheckCircle2,
  Database,
  Settings,
  LayoutDashboard,
  Workflow,
  Rocket,
  Sparkles,
  ArrowRight,
  Plus,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { Card, Skeleton } from '@/components/sabcrm/20ui';
import { useSabcrmSettings } from '@/components/sabcrm/twenty/sabcrm-settings-context';
import { useProject } from '@/context/project-context';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import { countSabcrmRecordsTw } from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/rust-client/sabcrm-objects';
import { ICONS } from '@/components/sabcrm/20ui/compat';
import './home.css';

const STANDARD_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  leads: Target,
  notes: StickyNote,
  tasks: CheckCircle2,
};

function iconFor(object: ObjectMetadata): LucideIcon {
  const picked = object.icon
    ? (ICONS[object.icon] as LucideIcon | undefined)
    : undefined;
  return picked ?? STANDARD_ICON[object.slug] ?? Database;
}

const QUICK_ACTIONS: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { href: '/sabcrm/dashboard', label: 'Dashboards', icon: LayoutDashboard },
  { href: '/dashboard/settings/crm/automations', label: 'Workflows', icon: Workflow },
  { href: '/sabcrm/ai', label: 'Ask AI', icon: Sparkles },
  { href: '/dashboard/settings/crm', label: 'Settings', icon: Settings },
  { href: '/sabcrm/getting-started', label: 'Getting Started', icon: Rocket },
];

export function SabcrmHomeClient(): React.JSX.Element {
  const { activeProjectId } = useProject();
  const { general } = useSabcrmSettings();
  const [objects, setObjects] = React.useState<ObjectMetadata[] | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  // Load the live object list (hide system + the renamed-away `opportunities`).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      const rows = res.ok
        ? res.data.filter((o) => !o.isSystem && o.slug !== 'opportunities')
        : [];
      setObjects(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Best-effort record counts per object (parallel, non-blocking).
  React.useEffect(() => {
    if (!objects || objects.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        objects.map(async (o) => {
          const res = await countSabcrmRecordsTw(
            o.slug,
            {},
            activeProjectId ?? undefined,
          );
          return [o.slug, res.ok ? res.data.count : 0] as const;
        }),
      );
      if (cancelled) return;
      setCounts(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [objects, activeProjectId]);

  const workspaceName = general.workspaceName?.trim();

  return (
    <div className="st-home">
      <div className="st-home__inner">
        <div className="st-home__hero">
          <TwentyPageHeader
            title={workspaceName ? `${workspaceName} CRM` : 'SabCRM'}
            icon={Building2}
          />
          <p className="st-lead">
            Your data, organised by object. Open any object to browse, filter and
            manage its records.
          </p>
        </div>

        {objects === null ? (
          <ul className="st-obj-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} style={{ display: 'flex' }}>
                <Card
                  variant="outlined"
                  className="st-obj-card--skeleton"
                  aria-hidden="true"
                >
                  <div className="st-obj-card__top">
                    <Skeleton width={32} height={32} radius="var(--st-radius)" />
                    <Skeleton width={96} height={16} />
                  </div>
                  <Skeleton width={64} height={12} />
                </Card>
              </li>
            ))}
          </ul>
        ) : objects.length === 0 ? (
          <div className="st-home__empty">
            <Database size={22} aria-hidden="true" />
            <p>No objects yet. Create one in the data model to get started.</p>
            <Link href="/dashboard/settings/crm/data-model" className="st-quick-link">
              <Plus size={14} aria-hidden="true" />
              Open data model
            </Link>
          </div>
        ) : (
          <ul className="st-obj-grid">
            {objects.map((object) => {
              const Icon = iconFor(object);
              const count = counts[object.slug];
              return (
                <li key={object.slug} style={{ display: 'flex' }}>
                  <Card variant="interactive" padding="none" className="st-obj-card-shell">
                    <Link
                      href={`/sabcrm/${object.slug}`}
                      className="st-obj-card"
                      aria-label={`${object.labelPlural}, view all`}
                    >
                      <div className="st-obj-card__top">
                        <span className="st-obj-card__icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <span className="st-obj-card__label">
                          {object.labelPlural}
                        </span>
                        {count !== undefined && (
                          <span className="st-obj-card__count">{count}</span>
                        )}
                      </div>
                      {object.description ? (
                        <span className="st-obj-card__desc">{object.description}</span>
                      ) : null}
                      <span className="st-obj-card__cta">
                        View all
                        <ArrowRight size={13} aria-hidden="true" />
                      </span>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <nav className="st-quick" aria-label="Quick links">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="st-quick-link">
              <Icon size={14} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default SabcrmHomeClient;
