'use client';

/**
 * Manage Users — CRM team workspace.
 *
 * Deepened per §1B list-page template (ref: sales-crm/all-leads/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (total / active / pending invites / admin count)
 *     • Filter row (search · role · status · department)
 *     • Bulk action bar (invite, role change, deactivate, export)
 *     • Member list rows with EntityRowLink → /dashboard/crm/team/manage-users/[id]
 *     • Pagination (controlled)
 *   <ConfirmDialog/> for bulk deactivate
 */

import * as React from 'react';
import Link from 'next/link';
import {
    Download,
    LoaderCircle,
    Plus,
    Shield,
    Trash2,
    UserPlus,
    Users,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, useToast } from '@/components/sabcrm/20ui';

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

export default function ManageUsersPage() {
    const { toast } = useToast();

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

    const [viewMode, setViewMode] = React.useState<'list' | 'org'>('list');

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

    // KPI strip
    const kpis = React.useMemo(() => {
        const total = members.length;
        const adminCount = members.filter((m) => deriveRole(m) === 'admin').length;
        const pendingCount = invites.filter((i) => i.status === 'pending').length;
        const activeCount = total; // every fetched member is an active project agent
        return { total, activeCount, pendingCount, adminCount };
    }, [members, invites]);

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
        a.download = `team-users-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected, pendingEmails]);

    const allSelectedOnPage =
        paged.length > 0 && paged.every((m) => selected.has(m._id.toString()));

    return (
        <>
            <EntityListShell
                title="Manage Users"
                subtitle="Invite, role-manage and audit every member with access to your CRM workspace."
                viewSwitcher={
                    <div className="flex bg-[var(--st-bg-muted)]/30 p-1 rounded-md border border-[var(--st-border)]">
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </Button>
                        <Button
                            variant={viewMode === 'org' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode('org')}
                        >
                            Org Chart
                        </Button>
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => {
                        setSearch(v);
                        setPage(1);
                    },
                    placeholder: 'Search by name or email…',
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
                    viewMode === 'list' ? (
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
                            <Users className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                {members.length === 0 ? 'No team members yet' : 'No matches'}
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                {members.length === 0
                                    ? 'Invite teammates to collaborate on accounts, leads and deals.'
                                    : 'Try clearing filters to see every member of your workspace.'}
                            </p>
                            {members.length === 0 ? (
                                <Button onClick={() => setInviteDialogOpen(true)}>
                                    <UserPlus className="h-4 w-4" /> Invite member
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
                {viewMode === 'org' ? (
                    <OrgChart members={members} pendingEmails={pendingEmails} />
                ) : (
                    <div className="flex flex-col gap-4">
                        <KpiStrip {...kpis} />

                        <Card className="p-0 overflow-hidden">
                            <div className="flex items-center gap-3 border-b border-[var(--st-border)] px-4 py-3 text-[12px] text-[var(--st-text-secondary)]">
                                <Checkbox
                                    checked={allSelectedOnPage}
                                    onCheckedChange={(v) => toggleAll(Boolean(v))}
                                    aria-label="Select all on page"
                                />
                                <span className="flex-1">Member</span>
                                <span className="hidden w-32 sm:inline">Role</span>
                                <span className="hidden w-32 md:inline">Department</span>
                                <span className="hidden w-24 md:inline">Status</span>
                                <span className="w-24 text-right">Projects</span>
                            </div>
                            {isLoading && members.length === 0 ? (
                                <div className="space-y-2 p-3">
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                    <Skeleton className="h-14 w-full" />
                                </div>
                            ) : (
                                <ul role="list" className="divide-y divide-[var(--st-border)]">
                                    {paged.map((m) => {
                                        const id = m._id.toString();
                                        const role = deriveRole(m);
                                        const status = deriveStatus(m, pendingEmails);
                                        const dept = deriveDepartment(m);
                                        const isSelf = currentUserId && id === currentUserId;
                                        return (
                                            <li
                                                key={id}
                                                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--st-bg)]/60"
                                            >
                                                <Checkbox
                                                    checked={selected.has(id)}
                                                    onCheckedChange={() => toggleOne(id)}
                                                    disabled={Boolean(isSelf)}
                                                    aria-label={`Select ${m.name}`}
                                                />
                                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage
                                                            src={`https://i.pravatar.cc/150?u=${m.email}`}
                                                            alt={m.name}
                                                        />
                                                        <AvatarFallback className="text-[11px]">
                                                            {m.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0 flex-1">
                                                        <EntityRowLink
                                                            href={`/dashboard/crm/team/manage-users/${id}`}
                                                            label={
                                                                <span className="truncate">
                                                                    {m.name}
                                                                    {isSelf ? (
                                                                        <span className="ml-2 text-[11px] text-[var(--st-text-secondary)]">
                                                                            (you)
                                                                        </span>
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
                                                <div className="hidden w-32 truncate text-[12.5px] text-[var(--st-text-secondary)] md:block">
                                                    {dept}
                                                </div>
                                                <div className="hidden w-24 md:block">
                                                    <StatusBadge status={status} />
                                                </div>
                                                <div className="w-24 text-right text-[12.5px] text-[var(--st-text-secondary)]">
                                                    {Object.keys(m.roles ?? {}).length}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>
                    </div>
                )}
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
    pendingCount: number;
    adminCount: number;
}

const KpiStrip = React.memo(function KpiStrip({
    total,
    activeCount,
    pendingCount,
    adminCount,
}: KpiProps) {
    const cards = [
        { label: 'Total users', value: total, icon: Users, accent: 'text-[var(--st-text)]' },
        {
            label: 'Active',
            value: activeCount,
            icon: Users,
            accent: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
        },
        {
            label: 'Pending invites',
            value: pendingCount,
            icon: UserPlus,
            accent: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
        },
        {
            label: 'Admins',
            value: adminCount,
            icon: Shield,
            accent: 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
        },
    ];
    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map((c) => {
                const Icon = c.icon;
                return (
                    <Card key={c.label} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-[12px] text-[var(--st-text-secondary)]">{c.label}</p>
                                <p className={`mt-1 text-2xl font-semibold ${c.accent}`}>
                                    {c.value.toLocaleString()}
                                </p>
                            </div>
                            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" />
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
                <SelectTrigger className="h-9 w-[160px] text-[12.5px]">
                    <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={statusFilter}
                onValueChange={(v) => onStatusChange(v as 'all' | 'active' | 'pending')}
            >
                <SelectTrigger className="h-9 w-[160px] text-[12.5px]">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={onDepartmentChange}>
                <SelectTrigger className="h-9 w-[200px] text-[12.5px]">
                    <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                            {d}
                        </SelectItem>
                    ))}
                </SelectContent>
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
            <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                {count} selected
            </span>
            <Button variant="outline" size="sm" onClick={onInvite}>
                <UserPlus className="h-3.5 w-3.5" /> Bulk invite
            </Button>
            <div className="flex items-center gap-1">
                <Select value={roleValue} onValueChange={onRoleValueChange}>
                    <SelectTrigger className="h-8 w-[120px] text-[12px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
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
    const { toast } = useToast();
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
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4" /> Invite member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite a new team member</DialogTitle>
                    <DialogDescription>
                        We email them a secure invite link. If they don&apos;t have a SabNode
                        account yet they can sign up and accept in one step.
                    </DialogDescription>
                </DialogHeader>
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
                            <SelectTrigger id="invite-role">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
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
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function OrgChart({ members, pendingEmails }: { members: MemberRow[], pendingEmails: Set<string> }) {
    const roles = ['owner', 'admin', 'agent', 'member'];
    
    return (
        <div className="flex flex-col items-center p-8 gap-8 bg-[var(--st-bg-muted)]/10 rounded-lg border border-[var(--st-border)] mt-4">
            {roles.map(role => {
                const group = members.filter(m => deriveRole(m) === role);
                if (group.length === 0) return null;
                return (
                    <div key={role} className="flex flex-col items-center relative w-full">
                        <div className="mb-4 font-semibold capitalize text-[var(--st-text-secondary)] text-sm tracking-widest">{role}s</div>
                        <div className="flex flex-wrap justify-center gap-4">
                            {group.map(member => (
                                <Card key={member._id.toString()} className="w-48 p-4 flex flex-col items-center gap-2 shadow-sm relative z-10 bg-[var(--st-bg-secondary)]">
                                    <Avatar className="w-12 h-12">
                                        <AvatarImage src={`https://i.pravatar.cc/150?u=${member.email}`} />
                                        <AvatarFallback>{member.name?.slice(0, 2).toUpperCase() || 'UN'}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-center">
                                        <p className="text-sm font-medium leading-none mb-1">{member.name || member.email.split('@')[0]}</p>
                                        <p className="text-xs text-[var(--st-text-secondary)] truncate w-40" title={member.email}>{member.email}</p>
                                    </div>
                                    <StatusBadge status={deriveStatus(member, pendingEmails)} />
                                </Card>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
