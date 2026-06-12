'use client';

/**
 * SabCRM hub (`/sabcrm`) — the client surface, 20ui.
 *
 * A live, data-driven entry page: it loads the workspace's real objects from
 * the data model (so custom objects + the renamed Leads show up, and the stale
 * `opportunities` slug is hidden) and a record count per object, then renders a
 * polished card grid + quick links. Everything fails closed to a sensible
 * empty/skeleton state so the page always renders inside the suite frame.
 *
 * 20ui only (`@/components/sabcrm/20ui` — PageHeader family, Card, Skeleton,
 * EmptyState, Button) plus the sibling `./hub.css` for page-local layout
 * (`.hub-*`, scoped to the 20ui root). The data layer is unchanged:
 * `listObjectsTw` + `countSabcrmRecordsTw`, both gated server actions.
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

import {
  Card,
  Skeleton,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  ICONS,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import { countSabcrmRecordsTw } from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/rust-client/sabcrm-objects';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './hub.css';

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

  return (
    <div className="hub-page">
      <div className="hub-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>SabCRM</PageTitle>
            <PageDescription>
              Your data, organised by object. Open any object to browse, filter
              and manage its records.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {objects === null ? (
          <ul className="hub-grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="hub-grid__item">
                <Card
                  variant="outlined"
                  className="hub-card--skeleton"
                  aria-hidden="true"
                >
                  <div className="hub-card__top">
                    <Skeleton width={32} height={32} radius="var(--st-radius)" />
                    <Skeleton width={96} height={16} />
                  </div>
                  <Skeleton width={64} height={12} />
                </Card>
              </li>
            ))}
          </ul>
        ) : objects.length === 0 ? (
          <div className="hub-empty">
            <EmptyState
              icon={Database}
              title="No objects yet"
              description="Create one in the data model to get started."
              action={
                <Link
                  href="/dashboard/settings/crm/data-model"
                  className="hub-quick__link"
                >
                  <Plus size={14} aria-hidden="true" />
                  Open data model
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="hub-grid">
            {objects.map((object) => {
              const Icon = iconFor(object);
              const count = counts[object.slug];
              return (
                <li key={object.slug} className="hub-grid__item">
                  <Card variant="interactive" padding="none" className="hub-card-shell">
                    <Link
                      href={`/sabcrm/${object.slug}`}
                      className="hub-card"
                      aria-label={`${object.labelPlural}, view all`}
                    >
                      <div className="hub-card__top">
                        <span className="hub-card__icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <span className="hub-card__label">
                          {object.labelPlural}
                        </span>
                        {count !== undefined && (
                          <span className="hub-card__count">{count}</span>
                        )}
                      </div>
                      {object.description ? (
                        <span className="hub-card__desc">{object.description}</span>
                      ) : null}
                      <span className="hub-card__cta">
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

        <nav className="hub-quick" aria-label="Quick links">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="hub-quick__link">
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
