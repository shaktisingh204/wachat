'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    LuUsers,
    LuShieldCheck,
    LuUserPlus,
    LuListChecks,
    LuMessagesSquare,
    LuActivity,
    LuBell,
    LuSettings,
    LuArrowUpRight,
    LuClock,
} from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
    recentInvites: InvitationView[];
};

const MODULE_TILES: Array<{
    href: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    tone: string;
}> = [
    {
        href: '/dashboard/team/manage-users',
        label: 'Members',
        description: 'See who belongs to the workspace and manage their project roles.',
        icon: LuUsers,
        tone: 'from-rose-400 to-rose-600',
    },
    {
        href: '/dashboard/team/manage-roles',
        label: 'Roles & permissions',
        description: 'Control which features each role can view, create, edit, or delete.',
        icon: LuShieldCheck,
        tone: 'from-indigo-400 to-indigo-600',
    },
    {
        href: '/dashboard/team/invites',
        label: 'Invitations',
        description: 'Track pending invites, resend emails, or revoke access before it lands.',
        icon: LuUserPlus,
        tone: 'from-amber-400 to-amber-600',
    },
    {
        href: '/dashboard/team/tasks',
        label: 'Tasks',
        description: 'Kanban board for everything the team is working on.',
        icon: LuListChecks,
        tone: 'from-emerald-400 to-emerald-600',
    },
    {
        href: '/dashboard/team/team-chat',
        label: 'Team chat',
        description: 'Direct messages and group channels for private collaboration.',
        icon: LuMessagesSquare,
        tone: 'from-sky-400 to-sky-600',
    },
    {
        href: '/dashboard/team/activity',
        label: 'Activity log',
        description: 'Audit trail of every team change: invites, role edits, removals.',
        icon: LuActivity,
        tone: 'from-violet-400 to-violet-600',
    },
    {
        href: '/dashboard/team/notifications',
        label: 'Notifications',
        description: 'Configure email digest, mentions, and team-event alerts.',
        icon: LuBell,
        tone: 'from-pink-400 to-pink-600',
    },
    {
        href: '/dashboard/team/settings',
        label: 'Workspace settings',
        description: 'Defaults for invites, signatures, and agent routing.',
        icon: LuSettings,
        tone: 'from-slate-400 to-slate-600',
    },
];

export default function TeamOverviewPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<Overview>({
        members: 0,
        pendingInvites: 0,
        expiredInvites: 0,
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
                setData({
                    members: (members as WithId<User>[]).length,
                    pendingInvites: pending.length,
                    expiredInvites: expired.length,
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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs items={[{ label: 'Team' }]} />

            <ClaySectionHeader
                size="lg"
                title="Team"
                subtitle="Everything about your people: members, roles, invites, tasks, chat, and audit."
                actions={
                    <div className="flex gap-2">
                        <Link href="/dashboard/team/manage-users">
                            <ClayButton variant="obsidian" size="sm" leading={<LuUserPlus className="h-4 w-4" />}>
                                Invite member
                            </ClayButton>
                        </Link>
                    </div>
                }
            />

            {/* Stat cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                    loading={loading}
                    label="Team members"
                    value={data.members}
                    icon={<LuUsers className="h-4 w-4" />}
                />
                <StatCard
                    loading={loading}
                    label="Pending invites"
                    value={data.pendingInvites}
                    icon={<LuUserPlus className="h-4 w-4" />}
                    tone="amber"
                />
                <StatCard
                    loading={loading}
                    label="Expired invites"
                    value={data.expiredInvites}
                    icon={<LuClock className="h-4 w-4" />}
                    tone="red"
                />
            </div>

            {/* Module tiles */}
            <div>
                <h2 className="mb-3 text-[14px] font-semibold text-foreground">Quick actions</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {MODULE_TILES.map((tile) => (
                        <Link key={tile.href} href={tile.href} className="group">
                            <ClayCard padded className="h-full transition-shadow group-hover:shadow-md">
                                <div
                                    className={cn(
                                        'mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                                        tile.tone,
                                    )}
                                >
                                    <tile.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13.5px] font-semibold text-foreground">{tile.label}</p>
                                    <LuArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </div>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                                    {tile.description}
                                </p>
                            </ClayCard>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent invites */}
            <ClayCard padded>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[14px] font-semibold text-foreground">Recent invitations</h2>
                        <p className="text-[12.5px] text-muted-foreground">
                            Latest 5 invites across all projects.
                        </p>
                    </div>
                    <Link href="/dashboard/team/invites">
                        <ClayButton variant="ghost" size="sm" trailing={<LuArrowUpRight className="h-4 w-4" />}>
                            See all
                        </ClayButton>
                    </Link>
                </div>
                {loading ? (
                    <div className="mt-4 space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : data.recentInvites.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/50 p-6 text-center text-[13px] text-muted-foreground">
                        No invitations yet. Start by inviting your first teammate.
                    </div>
                ) : (
                    <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                        {data.recentInvites.map((inv) => (
                            <li
                                key={inv._id}
                                className="flex items-center justify-between gap-4 px-4 py-3 text-[13px]"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{inv.inviteeEmail}</p>
                                    <p className="truncate text-[12px] text-muted-foreground">
                                        {inv.projectName ?? 'Workspace-wide'} · {inv.role}
                                    </p>
                                </div>
                                <InviteStatusBadge status={inv.isExpired ? 'expired' : inv.status} />
                            </li>
                        ))}
                    </ul>
                )}
            </ClayCard>
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    tone = 'neutral',
    loading,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone?: 'neutral' | 'amber' | 'red';
    loading: boolean;
}) {
    return (
        <ClayCard variant="soft" padded>
            <div className="flex items-start justify-between">
                <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                <div
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full',
                        tone === 'amber' && 'bg-amber-100 text-amber-700',
                        tone === 'red' && 'bg-red-100 text-red-700',
                        tone === 'neutral' && 'bg-accent text-primary',
                    )}
                >
                    {icon}
                </div>
            </div>
            <p className="mt-2 text-[28px] font-semibold leading-none text-foreground">
                {loading ? <Skeleton className="inline-block h-7 w-12" /> : value}
            </p>
        </ClayCard>
    );
}

function InviteStatusBadge({ status }: { status: InvitationView['status'] | 'expired' }) {
    if (status === 'accepted') return <ClayBadge tone="green">Accepted</ClayBadge>;
    if (status === 'expired') return <ClayBadge tone="red">Expired</ClayBadge>;
    if (status === 'revoked') return <ClayBadge tone="neutral">Revoked</ClayBadge>;
    return <ClayBadge tone="amber">Pending</ClayBadge>;
}
