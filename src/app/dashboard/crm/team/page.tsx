'use client';

/**
 * Team hub — CRM workspace overview list.
 *
 * Deepened per §1B list-page template (ref: sales-crm/all-leads/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (total members / active / role distribution / recent joins)
 *     • Filter row (search · role · status · department)
 *     • Bulk action bar (invite, role change, deactivate, export)
 *     • Member list with EntityRowLink → /dashboard/crm/team/manage-users/[id]
 *     • Pagination (controlled)
 *   <ConfirmDialog/> for bulk deactivate
 */

import * as React from 'react';
import {
    Activity,
    Download,
    LoaderCircle,
    Plus,
    Shield,
    Trash2,
    UserPlus,
    Users,
} from 'lucide-react';

import {
    Avatar,
    ZoruAvatarFallback,
    ZoruAvatarImage,
    Badge,
    Button,
    Card,
    Checkbox,
    Dialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogTrigger,
    Input,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    bulkChangeAgentRole,
    bulkRemoveAgents,
    getInvitedUsers,
    handleInviteAgent,
    listPendingInvitations,
    type InvitationView,
} from '@/app/actions/team.actions';
import { getSession } from '@/app/actions/user.actions';
import type { User, WithId } from '@/lib/definitions';

type MemberRow = WithId<User & { roles: Record<string, string> }>;

const PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;
const RECENT_JOIN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const inviteInitialState: { message?: string; error?: string } = {
    message: undefined,
    error: undefined,
};

function escapeCsv(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function deriveRole(member: MemberRow): string {
    const roles = Object.values(member.roles ?? {});
    if (roles.length === 0) return 'agent';
    return String(roles[0] ?? 'agent').toLowerCase();
}

function deriveDepartment(member: MemberRow): string {
    const businessName = (member as unknown as { businessProfile?: { name?: string } })
        ?.businessProfile?.name;
    return businessName?.trim() || 'General';
}

function deriveStatus(member: MemberRow, pendingEmails: Set<string>): 'active' | 'pending' {
    return pendingEmails.has(member.email.toLowerCase()) ? 'pending' : 'active';
}

function isRecentJoin(member: MemberRow): boolean {
    const ts = member.createdAt ? new Date(member.createdAt).getTime() : 0;
    if (!ts) return false;
    return Date.now() - ts <= RECENT_JOIN_WINDOW_MS;
}

export default function TeamHubPage() {
    const { toast } = useZoruToast();

    const [members, setMembers] = React.useState<MemberRow[]>([]);
    const [invites, setInvites] = React.useState<InvitationView[]>([]);
    const [isLoading, startTransition] = React.useTransition();
    const [currentUserId, setCurrentUserId] = React.useState<string | undefined>();

    const [search, setSearch] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'pending'>('all');
    const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');

    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkRoleValue, setBulkRoleValue] = React.useState<string>('agent');
    const [bulkBusy, setBulkBusy] = React.useState<false | 'role' | 'remove'>(false);
    const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [people, pending] = await Promise.all([
                getInvitedUsers(),
                listPendingInvitations(),
            ]);
            setMembers(people as MemberRow[]);
            setInvites(pending);
        });
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        getSession().then((s) => {
            if (cancelled) return;
            setCurrentUserId(s?.user?._id ? String(s.user._id) : undefined);
        });
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [fetchData]);

    const pendingEmails = React.useMemo(
        () => new Set(invites.filter((i) => i.status === 'pending').map((i) => i.inviteeEmail.toLowerCase())),
        [invites],
    );

    const departments = React.useMemo(() => {
        const set = new Set<string>();
        for (const m of members) set.add(deriveDepartment(m));
        return Array.from(set).sort();
    }, [members]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return members.filter((m) => {
            if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
            if (roleFilter !== 'all' && deriveRole(m) !== roleFilter) return false;
            if (statusFilter !== 'all' && deriveStatus(m, pendingEmails) !== statusFilter) return false;
            if (departmentFilter !== 'all' && deriveDepartment(m) !== departmentFilter) return false;
            return true;
        });
    }, [members, search, roleFilter, statusFilter, departmentFilter, pendingEmails]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const paged = React.useMemo(
        () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
        [filtered, safePage, pageSize],
    );

    // KPI strip — team hub angle: emphasise role split + recent joins.
    const kpis = React.useMemo(() => {
        const roleCounts = members.reduce(
            (acc, m) => {
                const r = deriveRole(m);
                acc[r] = (acc[r] ?? 0) + 1;
                return acc;
            },
            {} as Record<string, number>,
        );
        const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0];
        const recentJoinsCount = members.filter(isRecentJoin).length;
        return {
            total: members.length,
            activeCount: members.length,
            recentJoinsCount,
            topRoleLabel: topRole ? topRole[0] : 'agent',
            topRoleCount: topRole ? topRole[1] : 0,
        };
    }, [members]);

    const hasActiveFilters =
        search.length > 0 ||
        roleFilter !== 'all' ||
        statusFilter !== 'all' ||
        departmentFilter !== 'all';

    const clearFilters = React.useCallback(() => {
        setSearch('');
        setRoleFilter('all');
        setStatusFilter('all');
        setDepartmentFilter('all');
        setPage(1);
    }, []);

    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(paged.map((m) => m._id.toString())) : new Set());
        },
        [paged],
    );

    const handleBulkRoleChange = React.useCallback(async () => {
        if (selected.size === 0) return;
        setBulkBusy('role');
        const res = await bulkChangeAgentRole({
            agentUserIds: Array.from(selected),
            role: bulkRoleValue,
        });
        setBulkBusy(false);
        if (res.success) {
            toast({ title: `Updated ${res.updated ?? selected.size} member role(s)` });
            setSelected(new Set());
            fetchData();
        } else {
            toast({
                title: 'Bulk role change failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [selected, bulkRoleValue, fetchData, toast]);

    const handleBulkDeactivate = React.useCallback(async () => {
        if (selected.size === 0) return;
        setBulkBusy('remove');
        const res = await bulkRemoveAgents(Array.from(selected));
        setBulkBusy(false);
        if (res.success) {
            toast({ title: `Removed ${res.removed ?? selected.size} member(s)` });
            setSelected(new Set());
            fetchData();
        } else {
            toast({
                title: 'Bulk remove failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? filtered.filter((m) => selected.has(m._id.toString()))
                : filtered;
        const header = ['Name', 'Email', 'Role', 'Status', 'Department', 'Projects', 'JoinedAt'];
        const csv = [
            header.join(','),
            ...rows.map((m) =>
                [
                    escapeCsv(m.name),
                    escapeCsv(m.email),
                    escapeCsv(deriveRole(m)),
                    escapeCsv(deriveStatus(m, pendingEmails)),
                    escapeCsv(deriveDepartment(m)),
                    escapeCsv(Object.keys(m.roles ?? {}).length),
                    escapeCsv(m.createdAt ? new Date(m.createdAt).toISOString() : ''),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `team-hub-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected, pendingEmails]);

    const allSelectedOnPage =
        paged.length > 0 && paged.every((m) => selected.has(m._id.toString()));

    return (
        <>
            <EntityListShell
                title="Team"
                subtitle="Everyone collaborating across your CRM workspace, projects and pipelines."
                search={{
                    value: search,
                    onChange: (v) => {
                        setSearch(v);
                        setPage(1);
                    },
                    placeholder: 'Search teammates…',
                }}
                primaryAction={
                    <InviteMemberDialog
                        open={inviteDialogOpen}
                        onOpenChange={setInviteDialogOpen}
                        onInvited={fetchData}
                    />
                }
                filters={
                    <FilterRow
                        roleFilter={roleFilter}
                        onRoleChange={(v) => {
                            setRoleFilter(v);
                            setPage(1);
                        }}
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        departmentFilter={departmentFilter}
                        onDepartmentChange={(v) => {
                            setDepartmentFilter(v);
                            setPage(1);
                        }}
                        departments={departments}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <BulkBar
                            count={selected.size}
                            roleValue={bulkRoleValue}
                            onRoleValueChange={setBulkRoleValue}
                            onApplyRole={handleBulkRoleChange}
                            onDeactivate={() => setConfirmRemoveOpen(true)}
                            onInvite={() => setInviteDialogOpen(true)}
                            onExport={exportCsv}
                            onClear={() => setSelected(new Set())}
                            busy={bulkBusy}
                        />
                    ) : null
                }
                loading={isLoading && members.length === 0}
                pagination={
                    members.length > 0 ? (
                        <PaginationBar
                            page={safePage}
                            limit={pageSize}
                            hasMore={safePage < totalPages}
                            total={total}
                            pageSizes={[...PAGE_SIZES]}
                            controlled={{
                                onChange: (next) => {
                                    setPage(next.page);
                                    setPageSize(next.limit);
                                },
                            }}
                        />
                    ) : null
                }
                empty={
                    !isLoading && filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Users className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                {members.length === 0 ? 'No teammates yet' : 'No matches'}
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {members.length === 0
                                    ? 'Invite your first teammate to start collaborating on your CRM.'
                                    : 'Adjust filters to see your full team again.'}
                            </p>
                            {members.length === 0 ? (
                                <Button onClick={() => setInviteDialogOpen(true)}>
                                    <UserPlus className="h-4 w-4" /> Invite teammate
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <KpiStrip {...kpis} />

                    <Card className="overflow-hidden p-0">
                        <div className="flex items-center gap-3 border-b border-zoru-line px-4 py-3 text-[12px] text-zoru-ink-muted">
                            <Checkbox
                                checked={allSelectedOnPage}
                                onCheckedChange={(v) => toggleAll(Boolean(v))}
                                aria-label="Select all on page"
                            />
                            <span className="flex-1">Member</span>
                            <span className="hidden w-32 sm:inline">Role</span>
                            <span className="hidden w-32 md:inline">Department</span>
                            <span className="hidden w-24 md:inline">Status</span>
                            <span className="w-24 text-right">Joined</span>
                        </div>
                        {isLoading && members.length === 0 ? (
                            <div className="space-y-2 p-3">
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                            </div>
                        ) : (
                            <ul role="list" className="divide-y divide-zoru-line">
                                {paged.map((m) => {
                                    const id = m._id.toString();
                                    const role = deriveRole(m);
                                    const status = deriveStatus(m, pendingEmails);
                                    const dept = deriveDepartment(m);
                                    const isSelf = currentUserId && id === currentUserId;
                                    const joined = (() => {
                                        if (!m.createdAt) return '—';
                                        const date = new Date(m.createdAt);
                                        if (Number.isNaN(date.getTime())) return '—';
                                        const day = String(date.getUTCDate()).padStart(2, '0');
                                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const month = months[date.getUTCMonth()];
                                        const year = date.getUTCFullYear();
                                        return `${day} ${month} ${year}`;
                                    })();
                                    return (
                                        <li
                                            key={id}
                                            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zoru-bg/60"
                                        >
                                            <Checkbox
                                                checked={selected.has(id)}
                                                onCheckedChange={() => toggleOne(id)}
                                                disabled={Boolean(isSelf)}
                                                aria-label={`Select ${m.name}`}
                                            />
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <ZoruAvatarImage
                                                        src={`https://i.pravatar.cc/150?u=${m.email}`}
                                                        alt={m.name}
                                                    />
                                                    <ZoruAvatarFallback className="text-[11px]">
                                                        {m.name.substring(0, 2).toUpperCase()}
                                                    </ZoruAvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/team/manage-users/${id}`}
                                                        label={
                                                            <span className="truncate">
                                                                {m.name}
                                                                {isSelf ? (
                                                                    <span className="ml-2 text-[11px] text-zoru-ink-muted">
                                                                        (you)
                                                                    </span>
                                                                ) : null}
                                                                {isRecentJoin(m) ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="ml-2 text-[10px]"
                                                                    >
                                                                        New
                                                                    </Badge>
                                                                ) : null}
                                                            </span>
                                                        }
                                                        subtitle={
                                                            <span className="truncate">{m.email}</span>
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="hidden w-32 sm:block">
                                                <RoleBadge role={role} />
                                            </div>
                                            <div className="hidden w-32 truncate text-[12.5px] text-zoru-ink-muted md:block">
                                                {dept}
                                            </div>
                                            <div className="hidden w-24 md:block">
                                                <StatusBadge status={status} />
                                            </div>
                                            <div className="w-24 text-right text-[12.5px] text-zoru-ink-muted">
                                                {joined}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={confirmRemoveOpen}
                onOpenChange={setConfirmRemoveOpen}
                title={`Deactivate ${selected.size} member${selected.size === 1 ? '' : 's'}?`}
                description="They will be removed from every project you own and lose all CRM access. You can re-invite them later."
                confirmLabel="Deactivate"
                onConfirm={handleBulkDeactivate}
            />
        </>
    );
}

/* ─── KPI strip ──────────────────────────────────────────────────────── */

interface KpiProps {
    total: number;
    activeCount: number;
    recentJoinsCount: number;
    topRoleLabel: string;
    topRoleCount: number;
}

const KpiStrip = React.memo(function KpiStrip({
    total,
    activeCount,
    recentJoinsCount,
    topRoleLabel,
    topRoleCount,
}: KpiProps) {
    const cards = [
        {
            label: 'Total members',
            value: total.toLocaleString(),
            icon: Users,
            accent: 'text-zoru-ink',
        },
        {
            label: 'Active',
            value: activeCount.toLocaleString(),
            icon: Activity,
            accent: 'text-zoru-ink dark:text-zoru-ink-muted',
        },
        {
            label: 'Top role',
            value: `${topRoleLabel} · ${topRoleCount}`,
            icon: Shield,
            accent: 'text-zoru-ink dark:text-zoru-ink-muted',
        },
        {
            label: 'Recent joins (14d)',
            value: recentJoinsCount.toLocaleString(),
            icon: UserPlus,
            accent: 'text-zoru-ink dark:text-zoru-ink-muted',
        },
    ];
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((c) => {
                const Icon = c.icon;
                return (
                    <Card key={c.label} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[12px] text-zoru-ink-muted">{c.label}</p>
                                <p
                                    className={`mt-1 truncate text-2xl font-semibold capitalize ${c.accent}`}
                                >
                                    {c.value}
                                </p>
                            </div>
                            <Icon className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                        </div>
                    </Card>
                );
            })}
        </div>
    );
});

/* ─── Filter row ─────────────────────────────────────────────────────── */

interface FilterRowProps {
    roleFilter: string;
    onRoleChange: (v: string) => void;
    statusFilter: 'all' | 'active' | 'pending';
    onStatusChange: (v: 'all' | 'active' | 'pending') => void;
    departmentFilter: string;
    onDepartmentChange: (v: string) => void;
    departments: string[];
    hasActiveFilters: boolean;
    onClear: () => void;
}

function FilterRow({
    roleFilter,
    onRoleChange,
    statusFilter,
    onStatusChange,
    departmentFilter,
    onDepartmentChange,
    departments,
    hasActiveFilters,
    onClear,
}: FilterRowProps) {
    return (
        <>
            <Select value={roleFilter} onValueChange={onRoleChange}>
                <ZoruSelectTrigger className="h-9 w-[160px] text-[12.5px]">
                    <ZoruSelectValue placeholder="Role" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All roles</ZoruSelectItem>
                    <ZoruSelectItem value="owner">Owner</ZoruSelectItem>
                    <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                    <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                    <ZoruSelectItem value="member">Member</ZoruSelectItem>
                </ZoruSelectContent>
            </Select>
            <Select
                value={statusFilter}
                onValueChange={(v) => onStatusChange(v as 'all' | 'active' | 'pending')}
            >
                <ZoruSelectTrigger className="h-9 w-[160px] text-[12.5px]">
                    <ZoruSelectValue placeholder="Status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All status</ZoruSelectItem>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                </ZoruSelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={onDepartmentChange}>
                <ZoruSelectTrigger className="h-9 w-[200px] text-[12.5px]">
                    <ZoruSelectValue placeholder="Department" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                    {departments.map((d) => (
                        <ZoruSelectItem key={d} value={d}>
                            {d}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </Select>
            {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={onClear}>
                    Clear filters
                </Button>
            ) : null}
        </>
    );
}

/* ─── Bulk action bar ────────────────────────────────────────────────── */

interface BulkBarProps {
    count: number;
    roleValue: string;
    onRoleValueChange: (v: string) => void;
    onApplyRole: () => void;
    onDeactivate: () => void;
    onInvite: () => void;
    onExport: () => void;
    onClear: () => void;
    busy: false | 'role' | 'remove';
}

function BulkBar({
    count,
    roleValue,
    onRoleValueChange,
    onApplyRole,
    onDeactivate,
    onInvite,
    onExport,
    onClear,
    busy,
}: BulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-medium text-zoru-ink">
                {count} selected
            </span>
            <Button variant="outline" size="sm" onClick={onInvite}>
                <UserPlus className="h-3.5 w-3.5" /> Bulk invite
            </Button>
            <div className="flex items-center gap-1">
                <Select value={roleValue} onValueChange={onRoleValueChange}>
                    <ZoruSelectTrigger className="h-8 w-[120px] text-[12px]">
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                        <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                        <ZoruSelectItem value="member">Member</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onApplyRole}
                    disabled={busy === 'role'}
                >
                    {busy === 'role' ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Shield className="h-3.5 w-3.5" />
                    )}
                    Change role
                </Button>
            </div>
            <Button
                variant="destructive"
                size="sm"
                onClick={onDeactivate}
                disabled={busy === 'remove'}
            >
                {busy === 'remove' ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                )}
                Deactivate
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onClear}>
                Clear
            </Button>
        </div>
    );
}

/* ─── Badges ─────────────────────────────────────────────────────────── */

function RoleBadge({ role }: { role: string }) {
    const variant =
        role === 'owner' || role === 'admin' ? 'default' : role === 'member' ? 'outline' : 'secondary';
    return (
        <Badge variant={variant} className="capitalize">
            {role}
        </Badge>
    );
}

function StatusBadge({ status }: { status: 'active' | 'pending' }) {
    if (status === 'pending') {
        return <Badge variant="outline">Pending</Badge>;
    }
    return <Badge variant="secondary">Active</Badge>;
}

/* ─── Invite dialog ──────────────────────────────────────────────────── */

interface InviteMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvited: () => void;
}

function InviteMemberDialog({ open, onOpenChange, onInvited }: InviteMemberDialogProps) {
    const { toast } = useZoruToast();
    const [state, formAction] = React.useActionState(handleInviteAgent, inviteInitialState);
    const [isPending, startTransition] = React.useTransition();
    const formRef = React.useRef<HTMLFormElement>(null);

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Invitation sent', description: state.message });
            formRef.current?.reset();
            onOpenChange(false);
            onInvited();
        }
        if (state?.error) {
            toast({ title: 'Invite failed', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onInvited, onOpenChange]);

    const handleSubmit = (formData: FormData) => {
        startTransition(() => {
            formAction(formData);
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4" /> Invite teammate
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-md">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Invite a teammate</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        We email them a secure invite link. If they don&apos;t have a SabNode
                        account yet they can sign up and accept in one step.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input
                            id="invite-email"
                            name="email"
                            type="email"
                            placeholder="teammate@company.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select name="role" defaultValue="agent">
                            <ZoruSelectTrigger id="invite-role">
                                <ZoruSelectValue placeholder="Select role" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                                <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                                <ZoruSelectItem value="member">Member</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <ZoruDialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                            Send invite
                        </Button>
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
