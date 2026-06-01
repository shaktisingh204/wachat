'use client';

/**
 * SabCRM Settings Hub (`/sabcrm/settings`)
 *
 * Admin-gated entry point for the SabCRM workspace configuration surface.
 * Guards access via `listObjectsAction` (gate: 'view') to confirm a valid
 * session/project exists, then renders four section cards for:
 *
 *   1. Data Model  — custom objects, field management, relation editor.
 *   2. Members     — workspace member roster with derived CRM roles.
 *   3. Views       — saved views across all objects.
 *   4. Import/Export — bulk CSV import and export for any object.
 *
 * This page is intentionally a hub — each card links to a dedicated route
 * that will house the full interactive UI for that section. The hub renders
 * fast (one gated server-action call on mount) and degrades gracefully for
 * users without the `sabcrm:admin` RBAC key.
 *
 * Auth / onboarding / project guards are already enforced by the parent
 * `./layout.tsx`. The `listMembersAction` and `listObjectsAction` calls
 * inside this component re-run the full gate pipeline independently, so
 * any RBAC state change is reflected without a hard reload.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Database,
  Users,
  LayoutGrid,
  ArrowUpDown,
  Settings,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Shield,
  Layers,
  Zap,
  KeyRound,
} from 'lucide-react';

import {
  Button,
  Card,
  Badge,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Skeleton,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Separator,
} from '@/components/zoruui';
import { useProject } from '@/context/project-context';
import {
  listObjectsAction,
  listMembersAction,
} from '@/app/actions/sabcrm.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type { CrmMember } from '@/lib/sabcrm/members.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_BASE_PATH = '/sabcrm';

// ---------------------------------------------------------------------------
// Section card descriptor
// ---------------------------------------------------------------------------

interface SettingsSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  /** Short badge text shown in the card (e.g. "6 objects"). */
  badge?: string;
  /** True when the section is available; false to show a "coming soon" tag. */
  available: boolean;
}

// ---------------------------------------------------------------------------
// Hub card
// ---------------------------------------------------------------------------

interface SettingsHubCardProps {
  section: SettingsSection;
}

function SettingsHubCard({ section }: SettingsHubCardProps) {
  const content = (
    <Card
      variant="soft"
      interactive={section.available}
      className="group flex h-full flex-col gap-3 p-5"
      aria-label={`${section.title}${section.badge ? `, ${section.badge}` : ''}`}
    >
      {/* Icon row */}
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zoru-line bg-zoru-bg text-zoru-ink">
          {section.icon}
        </div>
        <div className="flex items-center gap-2">
          {section.badge && (
            <Badge variant="secondary" className="text-xs">
              {section.badge}
            </Badge>
          )}
          {!section.available && (
            <Badge variant="outline" className="text-xs">
              Coming soon
            </Badge>
          )}
          {section.available && (
            <ChevronRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zoru-ink">{section.title}</h2>
        <p className="text-sm leading-relaxed text-zoru-ink-muted">
          {section.description}
        </p>
      </div>
    </Card>
  );

  if (!section.available) {
    return <div className="flex cursor-default opacity-60">{content}</div>;
  }

  return (
    <Link
      href={section.href}
      className="block no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zoru-accent"
    >
      {content}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Admin notice
// ---------------------------------------------------------------------------

function AdminNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-zoru-ink-muted" />
      <p className="text-sm leading-relaxed text-zoru-ink-muted">
        Settings are visible to workspace owners and admins. Members with the{' '}
        <span className="font-medium text-zoru-ink">sabcrm:admin</span> capability
        can modify the data model, manage members, and run imports.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function HubSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <ZoruAlertTitle>Unable to load settings</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface HubData {
  objects: ObjectMetadata[];
  members: CrmMember[];
}

export default function SabcrmSettingsPage() {
  const { activeProjectId } = useProject();

  const [data, setData] = React.useState<HubData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch the two lists in parallel on mount / project switch. Both actions
  // run the full gate pipeline, so the page fails closed for anyone who
  // bypasses the layout guard or loses access mid-session.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    void (async () => {
      const pid = activeProjectId ?? undefined;
      const [objectsRes, membersRes] = await Promise.all([
        listObjectsAction(pid),
        listMembersAction(pid),
      ]);

      if (cancelled) return;

      if (!objectsRes.ok) {
        setError(objectsRes.error);
        setLoading(false);
        return;
      }
      // Members failure is non-fatal — surface an empty list rather than
      // blocking the whole hub (the member section card still appears but
      // with no count).
      setData({
        objects: objectsRes.data,
        members: membersRes.ok ? membersRes.data : [],
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // Derived counts for badges.
  const customObjectCount = data?.objects.filter((o) => !o.standard).length ?? 0;
  const standardObjectCount = data?.objects.filter((o) => o.standard).length ?? 0;
  const memberCount = data?.members.length ?? 0;
  const totalFieldCount = data?.objects.reduce(
    (acc, o) => acc + o.fields.filter((f) => !f.system).length,
    0,
  ) ?? 0;

  const sections: SettingsSection[] = [
    {
      id: 'data-model',
      icon: <Database className="h-5 w-5" />,
      title: 'Data Model',
      description:
        'Create and manage custom objects, add or reorder fields, define RELATION links between objects, and extend the six standard objects.',
      href: `${CRM_BASE_PATH}/settings/data-model`,
      badge:
        data != null
          ? customObjectCount > 0
            ? `${customObjectCount} custom, ${standardObjectCount} standard`
            : `${standardObjectCount} standard objects`
          : undefined,
      available: true,
    },
    {
      id: 'members',
      icon: <Users className="h-5 w-5" />,
      title: 'Members',
      description:
        'Review which workspace members have access to SabCRM and see their derived capability (view / manage / admin). Role changes are made in Workspace settings.',
      href: `${CRM_BASE_PATH}/settings/members`,
      badge:
        data != null && memberCount > 0
          ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
          : undefined,
      available: true,
    },
    {
      id: 'views',
      icon: <LayoutGrid className="h-5 w-5" />,
      title: 'Saved Views',
      description:
        'Browse, rename, or delete the saved table and board views across all objects. Set a default view for each object so every team member lands on the right layout.',
      href: `${CRM_BASE_PATH}/settings/views`,
      badge:
        data != null
          ? `${data.objects.length} ${data.objects.length === 1 ? 'object' : 'objects'}`
          : undefined,
      available: true,
    },
    {
      id: 'import-export',
      icon: <ArrowUpDown className="h-5 w-5" />,
      title: 'Import / Export',
      description:
        'Bulk-import records from a CSV file into any object with column mapping and per-row validation. Export up to 10,000 records as a flat CSV for reporting or migration.',
      href: `${CRM_BASE_PATH}/settings/import-export`,
      badge:
        data != null
          ? `${totalFieldCount} ${totalFieldCount === 1 ? 'field' : 'fields'} across ${data.objects.length} objects`
          : undefined,
      available: true,
    },
    {
      id: 'automations',
      icon: <Zap className="h-5 w-5" />,
      title: 'Automations',
      description:
        'Define event-driven rules that automatically create tasks, send notifications, or call webhooks when CRM records are created, updated, or deleted.',
      href: `${CRM_BASE_PATH}/settings/automations`,
      available: true,
    },
    {
      id: 'api',
      icon: <KeyRound className="h-5 w-5" />,
      title: 'API & Webhooks',
      description:
        'Issue and revoke bearer tokens for the SabCRM REST API, manage outbound webhook subscriptions, and view integration reference documentation.',
      href: `${CRM_BASE_PATH}/settings/api`,
      available: true,
    },
  ];

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
      {/* Page header */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            <Link
              href={CRM_BASE_PATH}
              className="text-zoru-ink-muted hover:text-zoru-ink"
            >
              SabCRM
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            Settings
          </ZoruPageEyebrow>
          <ZoruPageTitle>
            <span className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-zoru-ink-muted" aria-hidden />
              Settings
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Configure your CRM workspace — manage objects and fields, review
            member access, organise saved views, and run bulk imports.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {/* Admin capability notice */}
      <AdminNotice />

      <Separator className="my-6" />

      {/* Hub grid */}
      {loading ? (
        <HubSkeleton />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : (
        <>
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4"
            role="list"
            aria-label="Settings sections"
          >
            {sections.map((section) => (
              <div key={section.id} role="listitem">
                <SettingsHubCard section={section} />
              </div>
            ))}
          </div>

          {/* Workspace stats footer */}
          {data && (
            <div className="mt-10">
              <Separator className="mb-6" />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6">
                  <WorkspaceStat
                    icon={<Layers className="h-4 w-4" />}
                    label="Objects"
                    value={data.objects.length}
                    detail={
                      customObjectCount > 0
                        ? `${customObjectCount} custom`
                        : 'all standard'
                    }
                  />
                  <WorkspaceStat
                    icon={<Database className="h-4 w-4" />}
                    label="Fields"
                    value={totalFieldCount}
                    detail="across all objects"
                  />
                  <WorkspaceStat
                    icon={<Users className="h-4 w-4" />}
                    label="Members"
                    value={memberCount}
                    detail={
                      data.members.filter((m) => m.crmRole === 'admin').length > 0
                        ? `${data.members.filter((m) => m.crmRole === 'admin').length} admin`
                        : 'no admins'
                    }
                  />
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={CRM_BASE_PATH}>
                    Back to SabCRM
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading indicator for after initial data arrives (project switch) */}
      {loading && !data && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zoru-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace settings…
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Workspace stat chip
// ---------------------------------------------------------------------------

interface WorkspaceStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail?: string;
}

function WorkspaceStat({ icon, label, value, detail }: WorkspaceStatProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zoru-ink-muted">{icon}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums text-zoru-ink">
          {value}
        </span>
        <span className="text-sm text-zoru-ink-muted">
          {label}
          {detail && (
            <span className="ml-1 text-xs text-zoru-ink-subtle">({detail})</span>
          )}
        </span>
      </div>
    </div>
  );
}
