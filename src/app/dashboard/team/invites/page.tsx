'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    LuUserPlus,
    LuRefreshCw,
    LuCircleX,
    LuMail,
    LuClock,
    LuLoaderCircle,
    LuCopy,
    LuCheck,
} from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
} from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    listPendingInvitations,
    resendInvitation,
    revokeInvitation,
    type InvitationView,
} from '@/app/actions/team.actions';

type Filter = 'all' | 'pending' | 'expired' | 'accepted';

export default function TeamInvitesPage() {
    const [invites, setInvites] = useState<InvitationView[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const [pending, startTransition] = useTransition();
    const [copied, setCopied] = useState<string | null>(null);
    const { toast } = useToast();

    const refresh = () => {
        setLoading(true);
        listPendingInvitations()
            .then(setInvites)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refresh();
    }, []);

    const handleResend = (id: string) => {
        startTransition(async () => {
            const res = await resendInvitation(id);
            if (res.error) {
                toast({ title: 'Failed', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Invite resent' });
                refresh();
            }
        });
    };

    const handleRevoke = (id: string) => {
        startTransition(async () => {
            const res = await revokeInvitation(id);
            if (res.error) {
                toast({ title: 'Failed', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Invitation revoked' });
                refresh();
            }
        });
    };

    const handleCopyLink = (token: string) => {
        const url = `${window.location.origin}/invite/${token}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(token);
            setTimeout(() => setCopied(null), 1800);
        });
    };

    const visible = invites
        .filter((i) => {
            if (filter === 'all') return true;
            if (filter === 'expired') return i.status === 'expired' || i.isExpired;
            if (filter === 'pending') return i.status === 'pending' && !i.isExpired;
            return i.status === filter;
        })
        .filter(
            (i) =>
                !search ||
                i.inviteeEmail.toLowerCase().includes(search.toLowerCase()) ||
                i.projectName?.toLowerCase().includes(search.toLowerCase()),
        );

    const counts = {
        all: invites.length,
        pending: invites.filter((i) => i.status === 'pending' && !i.isExpired).length,
        expired: invites.filter((i) => i.isExpired || i.status === 'expired').length,
        accepted: invites.filter((i) => i.status === 'accepted').length,
    };

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Team', href: '/dashboard/team' },
                    { label: 'Invitations' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Invitations"
                subtitle="Track who's been invited to the workspace. Resend or revoke pending invites."
                actions={
                    <ClayButton
                        variant="ghost"
                        size="sm"
                        leading={<LuRefreshCw className="h-4 w-4" />}
                        onClick={refresh}
                    >
                        Refresh
                    </ClayButton>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-full border border-clay-border bg-clay-surface p-1">
                    {(['all', 'pending', 'expired', 'accepted'] as Filter[]).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors',
                                filter === f
                                    ? 'bg-clay-obsidian text-white'
                                    : 'text-clay-ink-muted hover:text-clay-ink',
                            )}
                        >
                            {f}
                            <span className="ml-1.5 text-[11px] opacity-80">({counts[f]})</span>
                        </button>
                    ))}
                </div>
                <div className="ml-auto w-full sm:w-64">
                    <ClayInput
                        placeholder="Search email or project…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        leading={<LuMail className="h-4 w-4" />}
                    />
                </div>
            </div>

            {/* List */}
            <ClayCard padded={false}>
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <div className="p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted">
                            <LuUserPlus className="h-5 w-5" />
                        </div>
                        <p className="text-[13px] font-semibold text-clay-ink">No invitations match</p>
                        <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                            Adjust the filter or invite a teammate from the Members page.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-clay-border">
                        {visible.map((inv) => {
                            const status = inv.isExpired ? 'expired' : inv.status;
                            const canResend = status === 'pending' || status === 'expired';
                            const canRevoke = status === 'pending';
                            return (
                                <li
                                    key={inv._id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-[13.5px] font-semibold text-clay-ink">
                                                {inv.inviteeEmail}
                                            </p>
                                            <StatusBadge status={status} />
                                        </div>
                                        <p className="mt-1 truncate text-[12.5px] text-clay-ink-muted">
                                            {inv.projectName ?? 'Workspace-wide'} · {inv.role}
                                            {inv.inviterName && ` · by ${inv.inviterName}`}
                                        </p>
                                        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-clay-ink-muted">
                                            <LuClock className="h-3 w-3" />
                                            {formatRelative(inv.createdAt)} · expires{' '}
                                            {formatRelative(inv.expiresAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ClayButton
                                            variant="ghost"
                                            size="sm"
                                            leading={
                                                copied === inv.token ? (
                                                    <LuCheck className="h-4 w-4" />
                                                ) : (
                                                    <LuCopy className="h-4 w-4" />
                                                )
                                            }
                                            onClick={() => handleCopyLink(inv.token)}
                                        >
                                            {copied === inv.token ? 'Copied' : 'Copy link'}
                                        </ClayButton>
                                        {canResend && (
                                            <ClayButton
                                                variant="ghost"
                                                size="sm"
                                                leading={
                                                    pending ? (
                                                        <LuLoaderCircle className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <LuRefreshCw className="h-4 w-4" />
                                                    )
                                                }
                                                onClick={() => handleResend(inv._id)}
                                                disabled={pending}
                                            >
                                                Resend
                                            </ClayButton>
                                        )}
                                        {canRevoke && (
                                            <ClayButton
                                                variant="ghost"
                                                size="sm"
                                                leading={<LuCircleX className="h-4 w-4" />}
                                                onClick={() => handleRevoke(inv._id)}
                                                disabled={pending}
                                            >
                                                Revoke
                                            </ClayButton>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </ClayCard>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'accepted') return <ClayBadge tone="green">Accepted</ClayBadge>;
    if (status === 'expired') return <ClayBadge tone="red">Expired</ClayBadge>;
    if (status === 'revoked') return <ClayBadge tone="neutral">Revoked</ClayBadge>;
    return <ClayBadge tone="amber">Pending</ClayBadge>;
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const units: Array<[number, string]> = [
        [60_000, 'minute'],
        [3_600_000, 'hour'],
        [86_400_000, 'day'],
        [604_800_000, 'week'],
    ];
    let chosen: [number, string] = [86_400_000, 'day'];
    for (const u of units) if (abs < u[0] * 60) chosen = u;
    const n = Math.max(1, Math.round(abs / chosen[0]));
    const unit = n === 1 ? chosen[1] : `${chosen[1]}s`;
    return diff < 0 ? `${n} ${unit} ago` : `in ${n} ${unit}`;
}
