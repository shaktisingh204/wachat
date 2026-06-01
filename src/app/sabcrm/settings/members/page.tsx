/**
 * /sabcrm/settings/members — SabCRM workspace members listing.
 *
 * Server Component. Renders the full workspace member roster for the active
 * project, each row enriched with the derived SabCRM capability (view /
 * manage / admin) and a human-readable description of what that capability
 * grants.
 *
 * Auth / onboarding / project context are enforced by
 * `src/app/sabcrm/layout.tsx`. The `listMembersAction` server action
 * independently re-runs the full session → project → RBAC → plan gate so
 * this page fails closed (error state) even when the layout guard passes.
 *
 * Role management is intentionally read-only here. Changing a member's
 * workspace role is a SabNode admin operation done via the main Settings →
 * Team page; a deep link is surfaced at the bottom of this page.
 */

import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck, Shield, Eye, ExternalLink, Users } from 'lucide-react';

import {
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  EmptyState,
  Separator,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/zoruui';
import { listMembersAction } from '@/app/actions/sabcrm.actions';
import type { CrmMember, CrmMemberRole } from '@/lib/sabcrm/members.server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Members — SabCRM Settings',
};

// ---------------------------------------------------------------------------
// Capability descriptor helpers
// ---------------------------------------------------------------------------

interface CapabilityInfo {
  label: string;
  description: string;
  badgeVariant: 'default' | 'secondary' | 'info' | 'warning';
  Icon: React.ElementType;
}

const CAPABILITY_INFO: Record<CrmMemberRole, CapabilityInfo> = {
  admin: {
    label: 'Admin',
    description:
      'Can manage the data model — create / edit / delete objects and fields — in addition to all record operations.',
    badgeVariant: 'default',
    Icon: ShieldCheck,
  },
  manage: {
    label: 'Manager',
    description:
      'Can create, edit, and delete CRM records. Cannot modify the data model (objects or fields).',
    badgeVariant: 'info',
    Icon: Shield,
  },
  view: {
    label: 'Viewer',
    description:
      'Can view all CRM records. Cannot create, edit, or delete records, or modify the data model.',
    badgeVariant: 'secondary',
    Icon: Eye,
  },
};

/** Derives initials from a display name or email fallback. */
function getInitials(name: string, email: string): string {
  const src = name.trim() || email.trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
  }
  return (src[0] ?? '?').toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components (server-renderable, no interactivity)
// ---------------------------------------------------------------------------

function MemberRow({ member }: { member: CrmMember }) {
  const info = CAPABILITY_INFO[member.crmRole];
  const { Icon } = info;
  const displayName = member.name.trim() || member.email;
  const initials = getInitials(member.name, member.email);

  return (
    <ZoruTableRow>
      {/* Avatar + identity */}
      <ZoruTableCell className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            {member.image ? (
              <ZoruAvatarImage
                src={member.image}
                alt={displayName}
              />
            ) : null}
            <ZoruAvatarFallback className="text-xs font-semibold">
              {initials}
            </ZoruAvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zoru-ink">
              {displayName}
              {member.isOwner && (
                <span className="ml-2 text-xs font-normal text-zoru-ink-muted">
                  (owner)
                </span>
              )}
            </p>
            <p className="truncate text-xs text-zoru-ink-muted">{member.email}</p>
          </div>
        </div>
      </ZoruTableCell>

      {/* Workspace role */}
      <ZoruTableCell className="py-3 pr-3 text-sm text-zoru-ink-muted capitalize">
        {member.projectRole}
      </ZoruTableCell>

      {/* SabCRM capability badge */}
      <ZoruTableCell className="py-3 pr-4">
        <Badge variant={info.badgeVariant} className="inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {info.label}
        </Badge>
      </ZoruTableCell>
    </ZoruTableRow>
  );
}

// ---------------------------------------------------------------------------
// Capability legend — explains what each RBAC key grants
// ---------------------------------------------------------------------------

function CapabilityLegend() {
  return (
    <Card variant="soft" className="mt-8">
      <ZoruCardHeader>
        <ZoruCardTitle className="text-sm font-semibold">
          Capability reference
        </ZoruCardTitle>
        <ZoruCardDescription className="text-xs">
          SabCRM capabilities are derived from each member's workspace role and
          map directly onto the{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-[11px]">
            sabcrm:view
          </code>{' '}
          /{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-[11px]">
            sabcrm:manage
          </code>{' '}
          /{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono text-[11px]">
            sabcrm:admin
          </code>{' '}
          RBAC keys.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ul className="space-y-3">
          {(Object.entries(CAPABILITY_INFO) as [CrmMemberRole, CapabilityInfo][]).map(
            ([role, info]) => {
              const { Icon } = info;
              return (
                <li key={role} className="flex items-start gap-3">
                  <Badge
                    variant={info.badgeVariant}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1.5"
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {info.label}
                  </Badge>
                  <p className="text-sm text-zoru-ink-muted">{info.description}</p>
                </li>
              );
            },
          )}
        </ul>

        <Separator className="my-4" />

        <p className="text-xs leading-relaxed text-zoru-ink-muted">
          Role mapping:{' '}
          <strong className="font-medium text-zoru-ink">owner</strong> and{' '}
          <strong className="font-medium text-zoru-ink">admin</strong> workspace
          roles become{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono">
            sabcrm:admin
          </code>
          ;{' '}
          <strong className="font-medium text-zoru-ink">manager</strong> becomes{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono">
            sabcrm:manage
          </code>
          ; all other roles (including the default{' '}
          <strong className="font-medium text-zoru-ink">agent</strong>) become{' '}
          <code className="rounded bg-zoru-surface-2 px-1 py-0.5 font-mono">
            sabcrm:view
          </code>
          .
        </p>
      </ZoruCardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SabcrmMembersSettingsPage() {
  const result = await listMembersAction();

  if (!result.ok) {
    return (
      <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
        <Alert variant="destructive">
          <ZoruAlertTitle>Members unavailable</ZoruAlertTitle>
          <ZoruAlertDescription>{result.error}</ZoruAlertDescription>
        </Alert>
      </main>
    );
  }

  const members = result.data;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
      {/* Page heading */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>SabCRM Settings</ZoruPageEyebrow>
          <ZoruPageTitle>Members</ZoruPageTitle>
          <ZoruPageDescription>
            Workspace members and their SabCRM access level. Roles are managed
            centrally in the SabNode workspace settings.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {/* Member table */}
      {members.length === 0 ? (
        <EmptyState
          title="No members found"
          description="This workspace has no members, or member data could not be loaded."
          icon={<Users className="h-8 w-8 text-zoru-ink-muted" />}
        />
      ) : (
        <Table aria-label="Workspace members and their SabCRM capabilities">
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="pl-4 text-xs font-medium text-zoru-ink-muted">
                Member
              </ZoruTableHead>
              <ZoruTableHead className="text-xs font-medium text-zoru-ink-muted">
                Workspace role
              </ZoruTableHead>
              <ZoruTableHead className="pr-4 text-xs font-medium text-zoru-ink-muted">
                SabCRM access
              </ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {members.map((member) => (
              <MemberRow key={member.userId} member={member} />
            ))}
          </ZoruTableBody>
        </Table>
      )}

      {/* Role count summary */}
      {members.length > 0 && (
        <p className="mt-3 text-xs text-zoru-ink-muted">
          {members.length} member{members.length !== 1 ? 's' : ''} &mdash;{' '}
          {members.filter((m) => m.crmRole === 'admin').length} admin
          {members.filter((m) => m.crmRole === 'admin').length !== 1 ? 's' : ''},{' '}
          {members.filter((m) => m.crmRole === 'manage').length} manager
          {members.filter((m) => m.crmRole === 'manage').length !== 1 ? 's' : ''},{' '}
          {members.filter((m) => m.crmRole === 'view').length} viewer
          {members.filter((m) => m.crmRole === 'view').length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Capability legend */}
      <CapabilityLegend />

      {/* Deep-link to workspace role admin */}
      <div className="mt-6 flex items-center gap-2">
        <ExternalLink className="h-4 w-4 shrink-0 text-zoru-ink-muted" aria-hidden />
        <p className="text-sm text-zoru-ink-muted">
          To change a member's role, go to{' '}
          <Link
            href="/dashboard/settings/team"
            className="font-medium text-zoru-ink underline underline-offset-2 hover:text-zoru-ink/80"
          >
            Settings &rarr; Team
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
