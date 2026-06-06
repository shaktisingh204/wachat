'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, Button, Card, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, cn } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useRef,
} from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
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
  } from 'lucide-react';

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
        icon: Users,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/manage-roles',
        label: 'Roles & permissions',
        description: 'Control which features each role can view, create, edit, or delete.',
        icon: ShieldCheck,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/invites',
        label: 'Invitations',
        description: 'Track pending invites, resend emails, or revoke access before it lands.',
        icon: UserPlus,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/tasks',
        label: 'Tasks',
        description: 'Kanban board for everything the team is working on.',
        icon: ListChecks,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/team-chat',
        label: 'Team chat',
        description: 'Direct messages and group channels for private collaboration.',
        icon: MessagesSquare,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/activity',
        label: 'Activity log',
        description: 'Audit trail of every team change: invites, role edits, removals.',
        icon: Activity,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/notifications',
        label: 'Notifications',
        description: 'Configure email digest, mentions, and team-event alerts.',
        icon: Bell,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
    },
    {
        href: '/dashboard/team/settings',
        label: 'Workspace settings',
        description: 'Defaults for invites, signatures, and agent routing.',
        icon: Settings,
        tone: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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

    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            if (loading) return; // Wait for initial loading
            
            const tl = gsap.timeline();
            tl.fromTo(
                '.gsap-fade-in',
                { opacity: 0, y: 15 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
            );
        },
        { scope: containerRef, dependencies: [loading] }
    );

    return (
        <div ref={containerRef} className="flex min-h-full flex-col gap-6">
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
                <Link href="/dashboard/team/manage-users">
                    <Button size="sm">
                        <UserPlus className="h-4 w-4" />
                        Invite member
                    </Button>
                </Link>
            </PageHeader>

            {/* Stat cards */}
            <div className="gsap-fade-in grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                    loading={loading}
                    label="Team members"
                    value={data.members}
                    icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                    loading={loading}
                    label="Pending invites"
                    value={data.pendingInvites}
                    icon={<UserPlus className="h-4 w-4" />}
                    tone="amber"
                />
                <StatCard
                    loading={loading}
                    label="Expired invites"
                    value={data.expiredInvites}
                    icon={<Clock className="h-4 w-4" />}
                    tone="red"
                />
            </div>

            {/* Module tiles */}
            <div className="gsap-fade-in">
                <h2 className="mb-3 text-[14px] text-[var(--st-text)]">Quick actions</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {MODULE_TILES.map((tile) => (
                        <Link key={tile.href} href={tile.href} className="group">
                            <Card className="h-full p-6 transition-shadow group-hover:shadow-md">
                                <div
                                    className={cn(
                                        'mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                                        tile.tone,
                                    )}
                                >
                                    <tile.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13.5px] text-[var(--st-text)]">{tile.label}</p>
                                    <ArrowUpRight className="h-4 w-4 text-[var(--st-text-secondary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </div>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                                    {tile.description}
                                </p>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Recent invites */}
            <Card className="gsap-fade-in p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[14px] text-[var(--st-text)]">Recent invitations</h2>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Latest 5 invites across all projects.
                        </p>
                    </div>
                    <Link href="/dashboard/team/invites">
                        <Button variant="ghost" size="sm">
                            See all
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
                {loading ? (
                    <div className="mt-4 space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : data.recentInvites.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
                        No invitations yet. Start by inviting your first teammate.
                    </div>
                ) : (
                    <ul className="mt-3 divide-y divide-[var(--st-border)] rounded-xl border border-[var(--st-border)]">
                        {data.recentInvites.map((inv) => (
                            <li
                                key={inv._id}
                                className="flex items-center justify-between gap-4 px-4 py-3 text-[13px]"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-[var(--st-text)]">{inv.inviteeEmail}</p>
                                    <p className="truncate text-[12px] text-[var(--st-text-secondary)]">
                                        {inv.projectName ?? 'Workspace-wide'} · {inv.role}
                                    </p>
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
        <Card variant="soft" className="p-6">
            <div className="flex items-start justify-between">
                <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                    {label}
                </p>
                <div
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full',
                        tone === 'amber' && 'bg-[var(--st-warn)]/15 text-[var(--st-warn)]',
                        tone === 'red' && 'bg-[var(--st-danger)]/10 text-[var(--st-danger)]',
                        tone === 'neutral' && 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
                    )}
                >
                    {icon}
                </div>
            </div>
            <p className="mt-2 text-[28px] leading-none text-[var(--st-text)]">
                {loading ? <Skeleton className="inline-block h-7 w-12" /> : value}
            </p>
        </Card>
    );
}

function InviteStatusBadge({ status }: { status: InvitationView['status'] | 'expired' }) {
    if (status === 'accepted') return <Badge variant="success">Accepted</Badge>;
    if (status === 'expired') return <Badge variant="danger">Expired</Badge>;
    if (status === 'revoked') return <Badge variant="ghost">Revoked</Badge>;
    return <Badge variant="warning">Pending</Badge>;
}
