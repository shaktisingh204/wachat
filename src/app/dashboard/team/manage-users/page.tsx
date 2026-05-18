'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  ArrowRight,
  Check,
  Clock,
  Loader,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
  } from 'lucide-react';

import * as React from 'react';

import {
    getInvitedUsers,
    handleInviteAgent,
    handleRemoveAgent,
    listPendingInvitations,
    resendInvitation,
    revokeInvitation,
    changeAgentRole,
    bulkRemoveAgents,
    bulkChangeAgentRole,
    type InvitationView,
} from '@/app/actions/team.actions';
import { getCustomRoles } from '@/app/actions/crm-roles.actions';
import { getProjects } from '@/app/actions/project.actions';
import type { CrmCustomRole, Project, User, WithId } from '@/lib/definitions';
import { useCan } from '@/context/project-context';

type MemberWithRoles = WithId<User & { roles: Record<string, string> }>;

type Tab = 'members' | 'invites';

export default function ManageUsersPage() {
    const { toast } = useZoruToast();
    const canInvite = useCan('team_users', 'create');
    const canEditRoles = useCan('team_users', 'edit');
    const canRemove = useCan('team_users', 'delete');
    const [tab, setTab] = React.useState<Tab>('members');
    const [query, setQuery] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState<string>('all');

    const [members, setMembers] = React.useState<MemberWithRoles[]>([]);
    const [invites, setInvites] = React.useState<InvitationView[]>([]);
    const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
    const [customRoles, setCustomRoles] = React.useState<CrmCustomRole[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [inviteOpen, setInviteOpen] = React.useState(false);
    const [selectedMembers, setSelectedMembers] = React.useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = React.useState<false | 'remove' | 'role'>(false);

    const fetchAll = React.useCallback(async () => {
        setLoading(true);
        const [m, inv, roles, projs] = await Promise.all([
            getInvitedUsers(),
            listPendingInvitations(),
            getCustomRoles(),
            getProjects(),
        ]);
        setMembers(m as MemberWithRoles[]);
        setInvites(inv);
        setCustomRoles(roles);
        setProjects(projs);
        setLoading(false);
    }, []);

    React.useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // When tab or filter changes, clear selection to prevent stale targets.
    React.useEffect(() => {
        setSelectedMembers(new Set());
    }, [tab, roleFilter, query]);

    const toggleSelect = React.useCallback((id: string) => {
        setSelectedMembers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = React.useCallback((ids: string[], on: boolean) => {
        setSelectedMembers((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
                if (on) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    }, []);

    const onBulkRemove = React.useCallback(() => {
        setBulkBusy('remove');
        (async () => {
            const res = await bulkRemoveAgents(Array.from(selectedMembers));
            setBulkBusy(false);
            if (res.success) {
                toast({ title: 'Removed', description: `${res.removed ?? 0} projects updated.` });
                setSelectedMembers(new Set());
                fetchAll();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        })();
    }, [selectedMembers, toast, fetchAll]);

    const onBulkChangeRole = React.useCallback(
        (role: string) => {
            setBulkBusy('role');
            (async () => {
                const res = await bulkChangeAgentRole({ agentUserIds: Array.from(selectedMembers), role });
                setBulkBusy(false);
                if (res.success) {
                    toast({ title: 'Roles updated', description: `${res.updated ?? 0} entries updated.` });
                    setSelectedMembers(new Set());
                    fetchAll();
                } else {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                }
            })();
        },
        [selectedMembers, toast, fetchAll],
    );

    const roleOptions = React.useMemo(
        () => [
            { value: 'agent', label: 'Agent' },
            { value: 'admin', label: 'Admin' },
            ...customRoles.map((r) => ({ value: r.id, label: r.name })),
        ],
        [customRoles],
    );

    const roleLabel = React.useCallback(
        (id: string) => {
            if (id === 'admin') return 'Admin';
            if (id === 'agent') return 'Agent';
            return customRoles.find((r) => r.id === id)?.name || id;
        },
        [customRoles],
    );

    const visibleMembers = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return members.filter((m) => {
            if (q) {
                const hay = `${m.name || ''} ${m.email || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (roleFilter !== 'all') {
                const hasRole = Object.values(m.roles || {}).some((r) => r === roleFilter);
                if (!hasRole) return false;
            }
            return true;
        });
    }, [members, query, roleFilter]);

    const visibleInvites = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return invites.filter((i) => {
            if (q && !`${i.inviteeEmail} ${i.projectName || ''}`.toLowerCase().includes(q)) return false;
            if (roleFilter !== 'all' && i.role !== roleFilter) return false;
            return true;
        });
    }, [invites, query, roleFilter]);

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/team/manage-users">Team</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Manage Users</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Team</ZoruPageTitle>
                    <ZoruPageDescription>
                        Invite teammates, assign roles, and manage access across your projects.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" size="md" onClick={fetchAll} disabled={loading}>
                        {loading ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Refresh
                    </ZoruButton>
                    {canInvite ? (
                        <InviteDialog
                            open={inviteOpen}
                            onOpenChange={setInviteOpen}
                            projects={projects}
                            customRoles={customRoles}
                            onInvited={() => {
                                setInviteOpen(false);
                                fetchAll();
                            }}
                            toast={toast}
                        />
                    ) : null}
                </div>
            </ZoruPageHeader>

            <StatsRow
                membersCount={members.length}
                invitesCount={invites.filter((i) => i.status === 'pending' && !i.isExpired).length}
                expiredCount={invites.filter((i) => i.isExpired || i.status === 'expired').length}
                projectsCount={projects.length}
            />

            {/* Filters */}
            <ZoruCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <ZoruInput
                        className="max-w-[320px] flex-1"
                        leadingSlot={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                        placeholder={tab === 'members' ? 'Search members' : 'Search invitations'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="w-[160px]">
                        <ZoruSelect value={roleFilter} onValueChange={setRoleFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All roles</ZoruSelectItem>
                                {roleOptions.map((r) => (
                                    <ZoruSelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>
                <TabSwitcher
                    tab={tab}
                    onChange={setTab}
                    members={members.length}
                    pending={invites.filter((i) => !i.isExpired && i.status === 'pending').length}
                />
            </ZoruCard>

            {tab === 'members' && selectedMembers.size > 0 ? (
                <BulkBar
                    count={selectedMembers.size}
                    busy={bulkBusy}
                    roleOptions={roleOptions}
                    canEditRoles={canEditRoles}
                    canRemove={canRemove}
                    onClear={() => setSelectedMembers(new Set())}
                    onChangeRole={onBulkChangeRole}
                    onRemove={onBulkRemove}
                />
            ) : null}

            {tab === 'members' ? (
                <MembersTable
                    loading={loading}
                    members={visibleMembers}
                    projects={projects}
                    roleOptions={roleOptions}
                    roleLabel={roleLabel}
                    canEditRoles={canEditRoles}
                    canRemove={canRemove}
                    selectedIds={selectedMembers}
                    onToggleSelect={toggleSelect}
                    onToggleAll={toggleSelectAll}
                    onRefresh={fetchAll}
                    toast={toast}
                />
            ) : (
                <InvitesTable
                    loading={loading}
                    invites={visibleInvites}
                    roleLabel={roleLabel}
                    onRefresh={fetchAll}
                    toast={toast}
                />
            )}
        </div>
    );
}

/* ──────────────────────────────────────────── STATS ─────────────────────────────────── */

function StatsRow(props: {
    membersCount: number;
    invitesCount: number;
    expiredCount: number;
    projectsCount: number;
}) {
    const stats = [
        { label: 'Active members', value: props.membersCount, icon: <Users className="h-4 w-4" /> },
        { label: 'Pending invites', value: props.invitesCount, icon: <Mail className="h-4 w-4" /> },
        { label: 'Expired invites', value: props.expiredCount, icon: <Clock className="h-4 w-4" /> },
        { label: 'Projects', value: props.projectsCount, icon: <Shield className="h-4 w-4" /> },
    ];
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
                <ZoruCard key={s.label} className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                        {s.icon}
                    </span>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.06em] text-zoru-ink-muted">
                            {s.label}
                        </div>
                        <div className="text-[20px] tracking-[-0.01em] text-zoru-ink">
                            {s.value}
                        </div>
                    </div>
                </ZoruCard>
            ))}
        </div>
    );
}

/* ────────────────────────────────────── TAB SWITCHER ────────────────────────────────── */

function TabSwitcher({
    tab,
    onChange,
    members,
    pending,
}: {
    tab: Tab;
    onChange: (t: Tab) => void;
    members: number;
    pending: number;
}) {
    return (
        <div className="inline-flex rounded-full border border-zoru-line bg-zoru-surface-2 p-1">
            {([
                { key: 'members', label: 'Members', count: members },
                { key: 'invites', label: 'Pending', count: pending },
            ] as const).map((t) => {
                const active = tab === t.key;
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full px-4 h-8 text-[12.5px] transition-colors',
                            active
                                ? 'bg-zoru-bg text-zoru-ink shadow-sm'
                                : 'text-zoru-ink-muted hover:text-zoru-ink',
                        )}
                    >
                        {t.label}
                        <span
                            className={cn(
                                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px]',
                                active
                                    ? 'bg-zoru-ink text-zoru-bg'
                                    : 'bg-zoru-bg text-zoru-ink-muted',
                            )}
                        >
                            {t.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ──────────────────────────────────── INVITE DIALOG ─────────────────────────────────── */

function InviteDialog({
    open,
    onOpenChange,
    projects,
    customRoles,
    onInvited,
    toast,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    projects: WithId<Project>[];
    customRoles: CrmCustomRole[];
    onInvited: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const [pending, setPending] = React.useState(false);
    const [role, setRole] = React.useState('agent');
    const [projectId, setProjectId] = React.useState<string>('');
    const formRef = React.useRef<HTMLFormElement>(null);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('role', role);
        fd.set('projectId', projectId);
        setPending(true);
        (async () => {
            const res = await handleInviteAgent(null, fd);
            setPending(false);
            if (res.message) {
                toast({ title: 'Invitation sent', description: res.message });
                formRef.current?.reset();
                setRole('agent');
                setProjectId('');
                onInvited();
            } else {
                toast({
                    title: 'Could not invite',
                    description: res.error || 'Please try again.',
                    variant: 'destructive',
                });
            }
        })();
    };

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogTrigger asChild>
                <ZoruButton size="md">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Invite member
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="max-w-md">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Invite a teammate</ZoruDialogTitle>
                </ZoruDialogHeader>
                <p className="-mt-2 text-[12.5px] text-zoru-ink-muted">
                    They&apos;ll receive a branded email with a one-click accept link valid for 7 days.
                </p>
                <form ref={formRef} onSubmit={onSubmit} className="mt-2 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11.5px] uppercase tracking-[0.06em] text-zoru-ink-muted">
                            Email
                        </label>
                        <ZoruInput
                            name="email"
                            type="email"
                            required
                            placeholder="teammate@company.com"
                            leadingSlot={<Mail className="h-3.5 w-3.5" strokeWidth={2} />}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11.5px] uppercase tracking-[0.06em] text-zoru-ink-muted">
                                Role
                            </label>
                            <ZoruSelect value={role} onValueChange={setRole}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="agent">Agent (default)</ZoruSelectItem>
                                    <ZoruSelectItem value="admin">Admin (full access)</ZoruSelectItem>
                                    {customRoles.map((r) => (
                                        <ZoruSelectItem key={r.id} value={r.id}>
                                            {r.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11.5px] uppercase tracking-[0.06em] text-zoru-ink-muted">
                                Project
                            </label>
                            <ZoruSelect
                                value={projectId || '__all'}
                                onValueChange={(v) => setProjectId(v === '__all' ? '' : v)}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__all">All my projects</ZoruSelectItem>
                                    {projects.map((p) => (
                                        <ZoruSelectItem key={p._id.toString()} value={p._id.toString()}>
                                            {p.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                        <ZoruButton
                            variant="outline"
                            size="md"
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton size="md" type="submit" disabled={pending}>
                            {pending ? (
                                <Loader className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
                            )}
                            Send invitation
                        </ZoruButton>
                    </div>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

/* ──────────────────────────────────── MEMBERS TABLE ─────────────────────────────────── */

function MembersTable({
    loading,
    members,
    projects,
    roleOptions,
    roleLabel,
    canEditRoles,
    canRemove,
    selectedIds,
    onToggleSelect,
    onToggleAll,
    onRefresh,
    toast,
}: {
    loading: boolean;
    members: MemberWithRoles[];
    projects: WithId<Project>[];
    roleOptions: { value: string; label: string }[];
    roleLabel: (id: string) => string;
    canEditRoles: boolean;
    canRemove: boolean;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: (ids: string[], on: boolean) => void;
    onRefresh: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const allIds = React.useMemo(() => members.map((m) => m._id.toString()), [members]);
    const allChecked = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    const someChecked = !allChecked && allIds.some((id) => selectedIds.has(id));
    const canSelect = canEditRoles || canRemove;
    if (loading) return <SkeletonRows />;
    if (!members.length) {
        return (
            <EmptyState
                title="No team members yet"
                body="Invite your first teammate to start collaborating across your projects."
                icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
            />
        );
    }
    return (
        <ZoruCard className="overflow-hidden p-0">
            <div className={'grid items-center gap-4 border-b border-zoru-line bg-zoru-surface-2 px-5 py-3 text-[11px] uppercase tracking-[0.06em] text-zoru-ink-muted ' + (canSelect ? 'grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_220px_160px_120px]' : 'grid-cols-[1fr_auto] sm:grid-cols-[1fr_220px_160px_120px]')}>
                {canSelect ? (
                    <SelectCheckbox
                        aria-label="Select all members"
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={(v) => onToggleAll(allIds, v)}
                    />
                ) : null}
                <span>Member</span>
                <span className="hidden sm:block">Projects & roles</span>
                <span className="hidden sm:block">Joined on</span>
                <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-zoru-line">
                {members.map((m) => (
                    <MemberRow
                        key={m._id.toString()}
                        member={m}
                        projects={projects}
                        roleOptions={roleOptions}
                        roleLabel={roleLabel}
                        canEditRoles={canEditRoles}
                        canRemove={canRemove}
                        canSelect={canSelect}
                        selected={selectedIds.has(m._id.toString())}
                        onToggleSelect={() => onToggleSelect(m._id.toString())}
                        onRefresh={onRefresh}
                        toast={toast}
                    />
                ))}
            </div>
        </ZoruCard>
    );
}

function MemberRow({
    member,
    projects,
    roleOptions,
    roleLabel,
    canEditRoles,
    canRemove,
    canSelect,
    selected,
    onToggleSelect,
    onRefresh,
    toast,
}: {
    member: MemberWithRoles;
    projects: WithId<Project>[];
    roleOptions: { value: string; label: string }[];
    roleLabel: (id: string) => string;
    canEditRoles: boolean;
    canRemove: boolean;
    canSelect: boolean;
    selected: boolean;
    onToggleSelect: () => void;
    onRefresh: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const [removing, setRemoving] = React.useState(false);
    const roleEntries = Object.entries(member.roles || {});

    const onRemoveAll = () => {
        setRemoving(true);
        (async () => {
            const fd = new FormData();
            fd.append('agentUserId', member._id.toString());
            const res = await handleRemoveAgent(null as any, fd);
            setRemoving(false);
            if (res.message) {
                toast({ title: 'Member removed', description: res.message });
                onRefresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        })();
    };

    return (
        <div className={'grid items-center gap-4 px-5 py-4 ' + (canSelect ? 'grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_1fr_220px_160px_120px]' : 'grid-cols-[1fr_auto] sm:grid-cols-[1fr_220px_160px_120px]') + (selected ? ' bg-zoru-surface-2/40' : '')}>
            {canSelect ? (
                <SelectCheckbox
                    aria-label={`Select ${member.name || member.email}`}
                    checked={selected}
                    onChange={onToggleSelect}
                />
            ) : null}
            <div className="flex items-center gap-3 min-w-0">
                <Avatar name={member.name || member.email} seed={member.email} />
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] text-zoru-ink">
                        {member.name || 'Unnamed member'}
                    </div>
                    <div className="truncate text-[12px] text-zoru-ink-muted">{member.email}</div>
                </div>
            </div>

            <div className="hidden flex-wrap gap-1.5 sm:flex">
                {roleEntries.length === 0 ? (
                    <ZoruBadge variant="ghost">No project roles</ZoruBadge>
                ) : (
                    roleEntries.slice(0, 3).map(([project, role]) => {
                        const projectObj = projects.find((p) => p.name === project);
                        return (
                            <ChangeRoleBadge
                                key={project}
                                projectName={project}
                                projectId={projectObj?._id.toString()}
                                memberId={member._id.toString()}
                                role={role}
                                roleOptions={roleOptions}
                                roleLabel={roleLabel}
                                canEdit={canEditRoles}
                                onRefresh={onRefresh}
                                toast={toast}
                            />
                        );
                    })
                )}
                {roleEntries.length > 3 ? (
                    <ZoruBadge variant="ghost">+{roleEntries.length - 3}</ZoruBadge>
                ) : null}
            </div>

            <div className="hidden text-[12px] text-zoru-ink-muted sm:block">
                {(member as any).createdAt
                    ? new Date((member as any).createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                      })
                    : '—'}
            </div>

            <div className="flex justify-end">
                {!canRemove ? null : (
                    <ZoruAlertDialog>
                        <ZoruAlertDialogTrigger asChild>
                            <ZoruButton
                                variant="ghost"
                                size="icon"
                                disabled={removing}
                                className="text-zoru-danger-ink hover:bg-zoru-danger/10"
                                aria-label="Remove member"
                            >
                                {removing ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                                )}
                            </ZoruButton>
                        </ZoruAlertDialogTrigger>
                        <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                                <ZoruAlertDialogTitle>Remove {member.name || member.email}?</ZoruAlertDialogTitle>
                                <ZoruAlertDialogDescription>
                                    This will revoke their access to every project you own. They can be re-invited later.
                                </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                                <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                <ZoruAlertDialogAction onClick={onRemoveAll}>Remove access</ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                        </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                )}
            </div>
        </div>
    );
}

function ChangeRoleBadge({
    projectName,
    projectId,
    memberId,
    role,
    roleOptions,
    roleLabel,
    canEdit,
    onRefresh,
    toast,
}: {
    projectName: string;
    projectId?: string;
    memberId: string;
    role: string;
    roleOptions: { value: string; label: string }[];
    roleLabel: (id: string) => string;
    canEdit: boolean;
    onRefresh: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    const saveRole = (next: string) => {
        if (!projectId) {
            toast({
                title: 'Missing project id',
                description: 'Refresh the page and try again.',
                variant: 'destructive',
            });
            return;
        }
        setSaving(true);
        (async () => {
            const res = await changeAgentRole({ projectId, agentUserId: memberId, role: next });
            setSaving(false);
            setOpen(false);
            if (res.success) {
                toast({ title: 'Role updated' });
                onRefresh();
            } else {
                toast({
                    title: 'Could not update role',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        })();
    };

    if (!canEdit) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 px-2.5 h-6 text-[11.5px] text-zoru-ink">
                <span className="text-zoru-ink-muted">{projectName}</span>
                <span className="text-zoru-ink-muted">·</span>
                <span>{roleLabel(role)}</span>
            </span>
        );
    }
    return (
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface-2 px-2.5 h-6 text-[11.5px] text-zoru-ink hover:bg-zoru-bg"
                >
                    <span className="text-zoru-ink-muted">{projectName}</span>
                    <span className="text-zoru-ink-muted">·</span>
                    <span>{roleLabel(role)}</span>
                </button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="max-w-sm">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Change role on {projectName}</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="mt-3 flex flex-col gap-2">
                    {roleOptions.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            disabled={saving}
                            onClick={() => saveRole(r.value)}
                            className={cn(
                                'flex items-center justify-between rounded-lg border border-zoru-line px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-zoru-surface-2',
                                r.value === role && 'bg-zoru-surface-2/60 border-zoru-line-strong',
                            )}
                        >
                            <span>{r.label}</span>
                            {r.value === role ? (
                                <Check className="h-4 w-4 text-zoru-ink" strokeWidth={2.25} />
                            ) : null}
                        </button>
                    ))}
                </div>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

/* ──────────────────────────────────── INVITES TABLE ─────────────────────────────────── */

function InvitesTable({
    loading,
    invites,
    roleLabel,
    onRefresh,
    toast,
}: {
    loading: boolean;
    invites: InvitationView[];
    roleLabel: (id: string) => string;
    onRefresh: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    if (loading) return <SkeletonRows />;
    if (!invites.length) {
        return (
            <EmptyState
                title="No pending invitations"
                body="Any open invitations you send will show up here until the recipient accepts."
                icon={<Mail className="h-5 w-5" strokeWidth={1.75} />}
            />
        );
    }
    return (
        <ZoruCard className="overflow-hidden p-0">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-zoru-line bg-zoru-surface-2 px-5 py-3 text-[11px] uppercase tracking-[0.06em] text-zoru-ink-muted sm:grid-cols-[1.2fr_160px_140px_140px_140px]">
                <span>Invitee</span>
                <span className="hidden sm:block">Project</span>
                <span className="hidden sm:block">Role</span>
                <span className="hidden sm:block">Expires</span>
                <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-zoru-line">
                {invites.map((inv) => (
                    <InviteRow
                        key={inv._id}
                        invite={inv}
                        roleLabel={roleLabel}
                        onRefresh={onRefresh}
                        toast={toast}
                    />
                ))}
            </div>
        </ZoruCard>
    );
}

function InviteRow({
    invite,
    roleLabel,
    onRefresh,
    toast,
}: {
    invite: InvitationView;
    roleLabel: (id: string) => string;
    onRefresh: () => void;
    toast: ReturnType<typeof useZoruToast>['toast'];
}) {
    const [busy, setBusy] = React.useState<false | 'resend' | 'revoke' | 'copy'>(false);

    const copyLink = () => {
        const url = `${window.location.origin}/invite/${invite.token}`;
        setBusy('copy');
        navigator.clipboard.writeText(url).then(
            () => {
                toast({ title: 'Link copied' });
                setTimeout(() => setBusy(false), 600);
            },
            () => {
                toast({ title: 'Copy failed', variant: 'destructive' });
                setBusy(false);
            },
        );
    };

    const resend = () => {
        setBusy('resend');
        (async () => {
            const res = await resendInvitation(invite._id);
            setBusy(false);
            if (res.success) {
                toast({ title: 'Invitation resent', description: res.message });
                onRefresh();
            } else {
                toast({ title: 'Could not resend', description: res.error, variant: 'destructive' });
            }
        })();
    };

    const revoke = () => {
        setBusy('revoke');
        (async () => {
            const res = await revokeInvitation(invite._id);
            setBusy(false);
            if (res.success) {
                toast({ title: 'Invitation revoked', description: res.message });
                onRefresh();
            } else {
                toast({ title: 'Could not revoke', description: res.error, variant: 'destructive' });
            }
        })();
    };

    const expired = invite.isExpired || invite.status === 'expired';

    return (
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[1.2fr_160px_140px_140px_140px]">
            <div className="flex min-w-0 items-center gap-3">
                <Avatar name={invite.inviteeEmail} seed={invite.inviteeEmail} />
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] text-zoru-ink">
                        {invite.inviteeEmail}
                    </div>
                    <div className="truncate text-[12px] text-zoru-ink-muted">
                        Invited by {invite.inviterName || invite.inviterEmail || 'you'}
                    </div>
                </div>
            </div>

            <div className="hidden text-[12.5px] text-zoru-ink sm:block">
                {invite.projectName || <span className="text-zoru-ink-muted">All my projects</span>}
            </div>

            <div className="hidden sm:block">
                <ZoruBadge variant="ghost">{roleLabel(invite.role)}</ZoruBadge>
            </div>

            <div className="hidden sm:block">
                {expired ? (
                    <ZoruBadge variant="danger">Expired</ZoruBadge>
                ) : (
                    <ZoruBadge variant="warning">{formatExpiresIn(invite.expiresAt)}</ZoruBadge>
                )}
            </div>

            <div className="flex items-center justify-end gap-1">
                <ZoruButton
                    variant="ghost"
                    size="icon"
                    onClick={copyLink}
                    aria-label="Copy invite link"
                    title="Copy invite link"
                    disabled={!!busy}
                >
                    {busy === 'copy' ? (
                        <Check className="h-4 w-4 text-zoru-success-ink" strokeWidth={2.25} />
                    ) : (
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ZoruButton>
                <ZoruButton
                    variant="ghost"
                    size="icon"
                    onClick={resend}
                    aria-label="Resend"
                    title="Resend email"
                    disabled={!!busy}
                >
                    {busy === 'resend' ? (
                        <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ZoruButton>
                <ZoruButton
                    variant="ghost"
                    size="icon"
                    onClick={revoke}
                    aria-label="Revoke"
                    title="Revoke invitation"
                    disabled={!!busy}
                    className="text-zoru-danger-ink hover:bg-zoru-danger/10"
                >
                    {busy === 'revoke' ? (
                        <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                        <X className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ZoruButton>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────── HELPERS ────────────────────────────────────── */

function Avatar({ name, seed }: { name: string; seed: string }) {
    const hue = hashHue(seed);
    const initials = (name || '?')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (
        <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zoru-line text-[12px]"
            style={{ background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 45% 28%)` }}
            aria-hidden
        >
            {initials || '?'}
        </div>
    );
}

function hashHue(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
}

function SkeletonRows() {
    return (
        <ZoruCard className="p-0">
            <div className="divide-y divide-zoru-line">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4">
                        <div className="h-9 w-9 animate-pulse rounded-full bg-zoru-surface-2" />
                        <div className="flex flex-1 flex-col gap-1.5">
                            <div className="h-3 w-32 animate-pulse rounded-full bg-zoru-surface-2" />
                            <div className="h-2.5 w-48 animate-pulse rounded-full bg-zoru-surface-2" />
                        </div>
                        <div className="h-6 w-24 animate-pulse rounded-full bg-zoru-surface-2" />
                    </div>
                ))}
            </div>
        </ZoruCard>
    );
}

function EmptyState({
    title,
    body,
    icon,
}: {
    title: string;
    body: string;
    icon: React.ReactNode;
}) {
    return (
        <ZoruCard className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                {icon}
            </span>
            <div className="text-[16px] text-zoru-ink">{title}</div>
            <div className="max-w-[360px] text-[12.5px] text-zoru-ink-muted">{body}</div>
        </ZoruCard>
    );
}

function SelectCheckbox({
    checked,
    indeterminate,
    onChange,
    ...rest
}: {
    checked: boolean;
    indeterminate?: boolean;
    onChange: (v: boolean) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'checked' | 'type'>) {
    const ref = React.useRef<HTMLInputElement | null>(null);
    React.useEffect(() => {
        if (ref.current) ref.current.indeterminate = Boolean(indeterminate && !checked);
    }, [indeterminate, checked]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.currentTarget.checked)}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-zoru-line accent-zoru-ink"
            {...rest}
        />
    );
}

function BulkBar({
    count,
    busy,
    roleOptions,
    canEditRoles,
    canRemove,
    onClear,
    onChangeRole,
    onRemove,
}: {
    count: number;
    busy: false | 'remove' | 'role';
    roleOptions: { value: string; label: string }[];
    canEditRoles: boolean;
    canRemove: boolean;
    onClear: () => void;
    onChangeRole: (role: string) => void;
    onRemove: () => void;
}) {
    return (
        <ZoruCard className="flex flex-col gap-3 border-zoru-line-strong bg-zoru-surface-2/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
                <ZoruBadge variant="default">{count} selected</ZoruBadge>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[12px] text-zoru-ink underline-offset-2 hover:underline"
                >
                    Clear selection
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {canEditRoles ? (
                    <div className="w-[200px]">
                        <ZoruSelect
                            value=""
                            disabled={!!busy}
                            onValueChange={(v) => {
                                if (v) onChangeRole(v);
                            }}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Set role to…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {roleOptions.map((r) => (
                                    <ZoruSelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                ) : null}
                {canRemove ? (
                    <ZoruButton
                        size="md"
                        onClick={onRemove}
                        disabled={!!busy}
                    >
                        {busy === 'remove' ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        Remove from all projects
                    </ZoruButton>
                ) : null}
            </div>
        </ZoruCard>
    );
}

function formatExpiresIn(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days >= 1) return `${days}d left`;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours >= 1) return `${hours}h left`;
    const mins = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `${mins}m left`;
}
