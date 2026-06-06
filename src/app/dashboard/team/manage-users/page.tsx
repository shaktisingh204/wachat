'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
    Avatar,
    AvatarFallback,
    Badge,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    EmptyState,
    Field,
    IconButton,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    SegmentedControl,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    ArrowRight,
    Check,
    Clock,
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
    const { toast } = useToast();
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
                toast.success({ title: 'Removed', description: `${res.removed ?? 0} projects updated.` });
                setSelectedMembers(new Set());
                fetchAll();
            } else {
                toast.error({ title: 'Error', description: res.error });
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
                    toast.success({ title: 'Roles updated', description: `${res.updated ?? 0} entries updated.` });
                    setSelectedMembers(new Set());
                    fetchAll();
                } else {
                    toast.error({ title: 'Error', description: res.error });
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
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/team/manage-users">Team</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Manage Users</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>Team</PageTitle>
                    <PageDescription>
                        Invite teammates, assign roles, and manage access across your projects.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button
                        variant="outline"
                        size="md"
                        iconLeft={RefreshCw}
                        loading={loading}
                        onClick={fetchAll}
                    >
                        Refresh
                    </Button>
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
                </PageActions>
            </PageHeader>

            <StatsRow
                membersCount={members.length}
                invitesCount={invites.filter((i) => i.status === 'pending' && !i.isExpired).length}
                expiredCount={invites.filter((i) => i.isExpired || i.status === 'expired').length}
                projectsCount={projects.length}
            />

            {/* Filters */}
            <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <Input
                        className="max-w-[320px] flex-1"
                        iconLeft={Search}
                        aria-label={tab === 'members' ? 'Search members' : 'Search invitations'}
                        placeholder={tab === 'members' ? 'Search members' : 'Search invitations'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="w-[160px]">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger aria-label="Filter by role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All roles</SelectItem>
                                {roleOptions.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <SegmentedControl<Tab>
                    aria-label="Switch between members and pending invites"
                    value={tab}
                    onChange={setTab}
                    items={[
                        { value: 'members', label: `Members (${members.length})` },
                        {
                            value: 'invites',
                            label: `Pending (${invites.filter((i) => !i.isExpired && i.status === 'pending').length})`,
                        },
                    ]}
                />
            </Card>

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
        { label: 'Active members', value: props.membersCount, icon: Users },
        { label: 'Pending invites', value: props.invitesCount, icon: Mail },
        { label: 'Expired invites', value: props.expiredCount, icon: Clock },
        { label: 'Projects', value: props.projectsCount, icon: Shield },
    ] as const;
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
            ))}
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
    toast: ReturnType<typeof useToast>['toast'];
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
                toast.success({ title: 'Invitation sent', description: res.message });
                formRef.current?.reset();
                setRole('agent');
                setProjectId('');
                onInvited();
            } else {
                toast.error({
                    title: 'Could not invite',
                    description: res.error || 'Please try again.',
                });
            }
        })();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="primary" size="md" iconLeft={Plus}>
                    Invite member
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite a teammate</DialogTitle>
                    <DialogDescription>
                        They will receive a branded email with a one-click accept link valid for 7 days.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} onSubmit={onSubmit} className="mt-2 flex flex-col gap-4">
                    <Field label="Email">
                        <Input
                            name="email"
                            type="email"
                            required
                            placeholder="teammate@company.com"
                            iconLeft={Mail}
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Role">
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger aria-label="Role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agent">Agent (default)</SelectItem>
                                    <SelectItem value="admin">Admin (full access)</SelectItem>
                                    {customRoles.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Project">
                            <Select
                                value={projectId || '__all'}
                                onValueChange={(v) => setProjectId(v === '__all' ? '' : v)}
                            >
                                <SelectTrigger aria-label="Project">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all">All my projects</SelectItem>
                                    {projects.map((p) => (
                                        <SelectItem key={p._id.toString()} value={p._id.toString()}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            size="md"
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            type="submit"
                            iconLeft={UserPlus}
                            loading={pending}
                        >
                            Send invitation
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const allIds = React.useMemo(() => members.map((m) => m._id.toString()), [members]);
    const allChecked = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    const someChecked = !allChecked && allIds.some((id) => selectedIds.has(id));
    const canSelect = canEditRoles || canRemove;
    if (loading) return <SkeletonRows />;
    if (!members.length) {
        return (
            <EmptyState
                icon={Users}
                title="No team members yet"
                description="Invite your first teammate to start collaborating across your projects."
            />
        );
    }
    return (
        <Card padding="none" className="overflow-hidden">
            <Table>
                <THead>
                    <Tr>
                        {canSelect ? (
                            <Th width={40} align="center">
                                <Checkbox
                                    aria-label="Select all members"
                                    checked={allChecked}
                                    indeterminate={someChecked}
                                    onChange={(e) => onToggleAll(allIds, e.currentTarget.checked)}
                                />
                            </Th>
                        ) : null}
                        <Th>Member</Th>
                        <Th className="hidden sm:table-cell">Projects &amp; roles</Th>
                        <Th className="hidden sm:table-cell">Joined on</Th>
                        <Th align="right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
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
                </TBody>
            </Table>
        </Card>
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
    toast: ReturnType<typeof useToast>['toast'];
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
                toast.success({ title: 'Member removed', description: res.message });
                onRefresh();
            } else {
                toast.error({ title: 'Error', description: res.error });
            }
        })();
    };

    return (
        <Tr selected={selected}>
            {canSelect ? (
                <Td align="center">
                    <Checkbox
                        aria-label={`Select ${member.name || member.email}`}
                        checked={selected}
                        onChange={onToggleSelect}
                    />
                </Td>
            ) : null}
            <Td>
                <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={member.name || member.email} seed={member.email} />
                    <div className="min-w-0">
                        <div className="truncate text-[13.5px] text-[var(--st-text)]">
                            {member.name || 'Unnamed member'}
                        </div>
                        <div className="truncate text-[12px] text-[var(--st-text-secondary)]">{member.email}</div>
                    </div>
                </div>
            </Td>

            <Td className="hidden sm:table-cell">
                <div className="flex flex-wrap gap-1.5">
                    {roleEntries.length === 0 ? (
                        <Badge tone="neutral">No project roles</Badge>
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
                        <Badge tone="neutral">+{roleEntries.length - 3}</Badge>
                    ) : null}
                </div>
            </Td>

            <Td className="hidden text-[12px] text-[var(--st-text-secondary)] sm:table-cell">
                {(member as any).createdAt
                    ? new Date((member as any).createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                      })
                    : '-'}
            </Td>

            <Td align="right">
                {!canRemove ? null : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <IconButton
                                label="Remove member"
                                icon={removing ? RefreshCw : Trash2}
                                variant="danger"
                                disabled={removing}
                            />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Remove {member.name || member.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will revoke their access to every project you own. They can be re-invited later.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={onRemoveAll}>Remove access</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </Td>
        </Tr>
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    const saveRole = (next: string) => {
        if (!projectId) {
            toast.error({
                title: 'Missing project id',
                description: 'Refresh the page and try again.',
            });
            return;
        }
        setSaving(true);
        (async () => {
            const res = await changeAgentRole({ projectId, agentUserId: memberId, role: next });
            setSaving(false);
            setOpen(false);
            if (res.success) {
                toast.success({ title: 'Role updated' });
                onRefresh();
            } else {
                toast.error({
                    title: 'Could not update role',
                    description: res.error,
                });
            }
        })();
    };

    const label = (
        <span>
            <span className="text-[var(--st-text-secondary)]">{projectName}</span>
            <span className="px-1 text-[var(--st-text-secondary)]">&middot;</span>
            <span>{roleLabel(role)}</span>
        </span>
    );

    if (!canEdit) {
        return <Badge tone="neutral">{label}</Badge>;
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Change role on {projectName}</DialogTitle>
                </DialogHeader>
                <div className="mt-3 flex flex-col gap-2">
                    {roleOptions.map((r) => (
                        <Button
                            key={r.value}
                            variant={r.value === role ? 'secondary' : 'ghost'}
                            disabled={saving}
                            onClick={() => saveRole(r.value)}
                            iconRight={r.value === role ? Check : undefined}
                            className={cn('justify-between', r.value === role && 'is-selected')}
                        >
                            {r.label}
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    if (loading) return <SkeletonRows />;
    if (!invites.length) {
        return (
            <EmptyState
                icon={Mail}
                title="No pending invitations"
                description="Any open invitations you send will show up here until the recipient accepts."
            />
        );
    }
    return (
        <Card padding="none" className="overflow-hidden">
            <Table>
                <THead>
                    <Tr>
                        <Th>Invitee</Th>
                        <Th className="hidden sm:table-cell">Project</Th>
                        <Th className="hidden sm:table-cell">Role</Th>
                        <Th className="hidden sm:table-cell">Expires</Th>
                        <Th align="right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {invites.map((inv) => (
                        <InviteRow
                            key={inv._id}
                            invite={inv}
                            roleLabel={roleLabel}
                            onRefresh={onRefresh}
                            toast={toast}
                        />
                    ))}
                </TBody>
            </Table>
        </Card>
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const [busy, setBusy] = React.useState<false | 'resend' | 'revoke' | 'copy'>(false);

    const copyLink = () => {
        const url = `${window.location.origin}/invite/${invite.token}`;
        setBusy('copy');
        navigator.clipboard.writeText(url).then(
            () => {
                toast.success({ title: 'Link copied' });
                setTimeout(() => setBusy(false), 600);
            },
            () => {
                toast.error({ title: 'Copy failed' });
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
                toast.success({ title: 'Invitation resent', description: res.message });
                onRefresh();
            } else {
                toast.error({ title: 'Could not resend', description: res.error });
            }
        })();
    };

    const revoke = () => {
        setBusy('revoke');
        (async () => {
            const res = await revokeInvitation(invite._id);
            setBusy(false);
            if (res.success) {
                toast.success({ title: 'Invitation revoked', description: res.message });
                onRefresh();
            } else {
                toast.error({ title: 'Could not revoke', description: res.error });
            }
        })();
    };

    const expired = invite.isExpired || invite.status === 'expired';

    return (
        <Tr>
            <Td>
                <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={invite.inviteeEmail} seed={invite.inviteeEmail} />
                    <div className="min-w-0">
                        <div className="truncate text-[13.5px] text-[var(--st-text)]">
                            {invite.inviteeEmail}
                        </div>
                        <div className="truncate text-[12px] text-[var(--st-text-secondary)]">
                            Invited by {invite.inviterName || invite.inviterEmail || 'you'}
                        </div>
                    </div>
                </div>
            </Td>

            <Td className="hidden text-[12.5px] text-[var(--st-text)] sm:table-cell">
                {invite.projectName || (
                    <span className="text-[var(--st-text-secondary)]">All my projects</span>
                )}
            </Td>

            <Td className="hidden sm:table-cell">
                <Badge tone="neutral">{roleLabel(invite.role)}</Badge>
            </Td>

            <Td className="hidden sm:table-cell">
                {expired ? (
                    <Badge tone="danger">Expired</Badge>
                ) : (
                    <Badge tone="warning">{formatExpiresIn(invite.expiresAt)}</Badge>
                )}
            </Td>

            <Td align="right">
                <div className="flex items-center justify-end gap-1">
                    <IconButton
                        label="Copy invite link"
                        icon={busy === 'copy' ? Check : ArrowRight}
                        variant="ghost"
                        onClick={copyLink}
                        disabled={!!busy}
                    />
                    <IconButton
                        label="Resend email"
                        icon={RefreshCw}
                        variant="ghost"
                        onClick={resend}
                        disabled={!!busy}
                    />
                    <IconButton
                        label="Revoke invitation"
                        icon={X}
                        variant="danger"
                        onClick={revoke}
                        disabled={!!busy}
                    />
                </div>
            </Td>
        </Tr>
    );
}

/* ─────────────────────────────────────── HELPERS ────────────────────────────────────── */

function MemberAvatar({ name, seed }: { name: string; seed: string }) {
    const hue = hashHue(seed);
    const initials = (name || '?')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (
        <Avatar data-shape="round" aria-hidden>
            {/* Deterministic per-user tint is genuinely runtime-computed. */}
            <AvatarFallback style={{ background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 45% 28%)` }}>
                {initials || '?'}
            </AvatarFallback>
        </Avatar>
    );
}

function hashHue(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
}

function SkeletonRows() {
    return (
        <Card padding="none">
            <div className="divide-y divide-[var(--st-border)]">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4">
                        <Skeleton circle width={36} />
                        <div className="flex flex-1 flex-col gap-1.5">
                            <Skeleton width={128} height={12} radius={9999} />
                            <Skeleton width={192} height={10} radius={9999} />
                        </div>
                        <Skeleton width={96} height={24} radius={9999} />
                    </div>
                ))}
            </div>
        </Card>
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
        <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
                <Badge tone="accent">{count} selected</Badge>
                <Button variant="ghost" size="sm" onClick={onClear}>
                    Clear selection
                </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {canEditRoles ? (
                    <div className="w-[200px]">
                        <Select
                            value=""
                            disabled={!!busy}
                            onValueChange={(v) => {
                                if (v) onChangeRole(v);
                            }}
                        >
                            <SelectTrigger aria-label="Set role for selected members">
                                <SelectValue placeholder="Set role to..." />
                            </SelectTrigger>
                            <SelectContent>
                                {roleOptions.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}
                {canRemove ? (
                    <Button
                        variant="danger"
                        size="md"
                        iconLeft={Trash2}
                        loading={busy === 'remove'}
                        disabled={!!busy}
                        onClick={onRemove}
                    >
                        Remove from all projects
                    </Button>
                ) : null}
            </div>
        </Card>
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
