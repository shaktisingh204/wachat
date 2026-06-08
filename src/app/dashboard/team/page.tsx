'use client';

import {
  AvatarFallback,
  Avatar,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  UserPlus,
  ListChecks,
  MessagesSquare,
  Activity,
  Bell,
  Settings,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  getInvitedUsers,
  listPendingInvitations,
  type InvitationView,
} from '@/app/actions/team.actions';
import type { WithId, User } from '@/lib/definitions';

type Overview = {
  members: number;
  pendingInvites: number;
  expiredInvites: number;
  acceptedInvites: number;
  recentInvites: InvitationView[];
};

const MODULE_TILES: Array<{
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    href: '/dashboard/team/manage-users',
    label: 'Members',
    description: 'See who belongs to the workspace and manage their project roles.',
    icon: Users,
  },
  {
    href: '/dashboard/team/manage-roles',
    label: 'Roles & permissions',
    description: 'Control which features each role can view, create, edit, or delete.',
    icon: ShieldCheck,
  },
  {
    href: '/dashboard/team/invites',
    label: 'Invitations',
    description: 'Track pending invites, resend emails, or revoke access before it lands.',
    icon: UserPlus,
  },
  {
    href: '/dashboard/team/tasks',
    label: 'Tasks',
    description: 'Plan, assign, and track everything the team is working on.',
    icon: ListChecks,
  },
  {
    href: '/dashboard/team/team-chat',
    label: 'Team chat',
    description: 'Direct messages and group channels for private collaboration.',
    icon: MessagesSquare,
  },
  {
    href: '/dashboard/team/activity',
    label: 'Activity log',
    description: 'Audit trail of every team change: invites, role edits, removals.',
    icon: Activity,
  },
  {
    href: '/dashboard/team/notifications',
    label: 'Notifications',
    description: 'Configure email digests, mentions, and team-event alerts.',
    icon: Bell,
  },
  {
    href: '/dashboard/team/settings',
    label: 'Workspace settings',
    description: 'Defaults for invites, agent routing, and business hours.',
    icon: Settings,
  },
];

export default function TeamOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview>({
    members: 0,
    pendingInvites: 0,
    expiredInvites: 0,
    acceptedInvites: 0,
    recentInvites: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [members, invites] = await Promise.all([
          getInvitedUsers(),
          listPendingInvitations(),
        ]);
        if (cancelled) return;
        const pending = invites.filter((i) => i.status === 'pending' && !i.isExpired);
        const expired = invites.filter((i) => i.status === 'expired' || i.isExpired);
        const accepted = invites.filter((i) => i.status === 'accepted');
        setData({
          members: (members as WithId<User>[]).length,
          pendingInvites: pending.length,
          expiredInvites: expired.length,
          acceptedInvites: accepted.length,
          recentInvites: invites.slice(0, 5),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Team</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Team</PageTitle>
          <PageDescription>
            Everything about your people: members, roles, invites, tasks, chat, and audit.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild size="md" variant="primary">
            <Link href="/dashboard/team/manage-users">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite member
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md">
              <Skeleton width={96} height={11} radius={9999} />
              <Skeleton className="mt-3" width={48} height={26} radius={6} />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Team members"
              value={data.members}
              icon={Users}
              accent="var(--st-accent)"
            />
            <StatCard label="Pending invites" value={data.pendingInvites} icon={UserPlus} />
            <StatCard label="Accepted" value={data.acceptedInvites} icon={CheckCircle2} />
            <StatCard
              label="Expired invites"
              value={data.expiredInvites}
              icon={Clock}
              delta={
                data.expiredInvites > 0 ? { value: 'Review', tone: 'down' } : undefined
              }
            />
          </>
        )}
      </div>

      {/* Module tiles */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-[var(--st-text)]">
          <Inbox className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          Quick actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group rounded-[var(--st-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]"
              >
                <Card variant="interactive" padding="md" className="h-full">
                  <div className="mb-3 flex items-start justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                      aria-hidden="true"
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 text-[var(--st-text-secondary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-[13.5px] font-medium text-[var(--st-text)]">{tile.label}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                    {tile.description}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent invitations */}
      <Card padding="none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[var(--st-border)]">
          <div className="flex items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
              aria-hidden="true"
            >
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Recent invitations</CardTitle>
              <CardDescription>Latest 5 invites across all projects.</CardDescription>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/team/invites">
              See all
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>

        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton circle width={32} />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton width={160} height={11} radius={9999} />
                  <Skeleton width={220} height={10} radius={9999} />
                </div>
                <Skeleton width={72} height={22} radius={9999} />
              </div>
            ))}
          </div>
        ) : data.recentInvites.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No invitations yet"
            description="Invite your first teammate to start collaborating across your projects."
            action={
              <Button asChild size="sm" variant="primary">
                <Link href="/dashboard/team/manage-users">
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Invite member
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {data.recentInvites.map((inv) => (
              <li
                key={inv._id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <InviteeAvatar email={inv.inviteeEmail} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[var(--st-text)]">{inv.inviteeEmail}</p>
                    <p className="truncate text-[12px] text-[var(--st-text-secondary)]">
                      {inv.projectName ?? 'Workspace-wide'} · {inv.role}
                    </p>
                  </div>
                </div>
                <InviteStatusBadge status={inv.isExpired ? 'expired' : inv.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InviteeAvatar({ email }: { email: string }) {
  const hue = hashHue(email);
  const initials = (email || '?').slice(0, 2).toUpperCase();
  return (
    <Avatar data-shape="round" aria-hidden>
      {/* Deterministic per-invitee tint is genuinely runtime-computed. */}
      <AvatarFallback style={{ background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 45% 28%)` }}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function InviteStatusBadge({ status }: { status: InvitationView['status'] | 'expired' }) {
  if (status === 'accepted') return <Badge tone="success">Accepted</Badge>;
  if (status === 'expired') return <Badge tone="danger">Expired</Badge>;
  if (status === 'revoked') return <Badge tone="neutral">Revoked</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}
