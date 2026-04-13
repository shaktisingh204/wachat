'use client';

import * as React from 'react';
import {
    LuArrowRight,
    LuCheck,
    LuClock,
    LuLoader,
    LuMail,
    LuPlus,
    LuRefreshCw,
    LuSearch,
    LuShield,
    LuTrash2,
    LuUserPlus,
    LuUsers,
    LuX,
} from 'react-icons/lu';

import { ClayBadge } from '@/components/clay/clay-badge';
import { ClayBreadcrumbs } from '@/components/clay/clay-breadcrumbs';
import { ClayButton } from '@/components/clay/clay-button';
import { ClayCard } from '@/components/clay/clay-card';
import { ClayInput, ClaySelect } from '@/components/clay/clay-input';
import { ClaySectionHeader } from '@/components/clay/clay-section-header';
import { useToast } from '@/hooks/use-toast';
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
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    getInvitedUsers,
    handleInviteAgent,
    handleRemoveAgent,
    listPendingInvitations,
    resendInvitation,
    revokeInvitation,
    changeAgentRole,
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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'SabNode', href: '/home' },
                    { label: 'Team', href: '/dashboard/team/manage-users' },
                    { label: 'Manage Users' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Team"
                subtitle="Invite teammates, assign roles, and manage access across your projects."
                actions={
                    <>
                        <ClayButton
                            variant="pill"
                            size="md"
                            onClick={fetchAll}
                            disabled={loading}
                            leading={
                                loading ? (
                                    <LuLoader className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <LuRefreshCw className="h-3.5 w-3.5" />
                                )
                            }
                        >
                            Refresh
                        </ClayButton>
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
                    </>
                }
            />

            <StatsRow
                membersCount={members.length}
                invitesCount={invites.filter((i) => i.status === 'pending' && !i.isExpired).length}
                expiredCount={invites.filter((i) => i.isExpired || i.status === 'expired').length}
                projectsCount={projects.length}
            />

            {/* Filters */}
            <ClayCard padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                    <ClayInput
                        sizeVariant="md"
                        className="max-w-[320px] flex-1"
                        leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
                        placeholder={tab === 'members' ? 'Search members' : 'Search invitations'}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <ClaySelect
                        sizeVariant="md"
                        className="w-[160px]"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        options={[{ value: 'all', label: 'All roles' }, ...roleOptions]}
                    />
                </div>
                <TabSwitcher
                    tab={tab}
                    onChange={setTab}
                    members={members.length}
                    pending={invites.filter((i) => !i.isExpired && i.status === 'pending').length}
                />
            </ClayCard>

            {tab === 'members' ? (
                <MembersTable
                    loading={loading}
                    members={visibleMembers}
                    projects={projects}
                    roleOptions={roleOptions}
                    roleLabel={roleLabel}
                    canEditRoles={canEditRoles}
                    canRemove={canRemove}
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
        { label: 'Active members', value: props.membersCount, icon: <LuUsers className="h-4 w-4" /> },
        { label: 'Pending invites', value: props.invitesCount, icon: <LuMail className="h-4 w-4" /> },
        { label: 'Expired invites', value: props.expiredCount, icon: <LuClock className="h-4 w-4" /> },
        { label: 'Projects', value: props.projectsCount, icon: <LuShield className="h-4 w-4" /> },
    ];
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
                <ClayCard key={s.label} padded={false} className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-surface-2 text-clay-ink-muted">
                        {s.icon}
                    </span>
                    <div>
                        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">
                            {s.label}
                        </div>
                        <div className="text-[20px] font-semibold tracking-[-0.01em] text-clay-ink">
                            {s.value}
                        </div>
                    </div>
                </ClayCard>
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
        <div className="inline-flex rounded-full border border-clay-border bg-clay-surface-2 p-1">
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
                        className={
                            'inline-flex items-center gap-2 rounded-full px-4 h-8 text-[12.5px] font-medium transition-colors ' +
                            (active
                                ? 'bg-clay-surface text-clay-ink shadow-clay-xs'
                                : 'text-clay-ink-muted hover:text-clay-ink')
                        }
                    >
                        {t.label}
                        <span
                            className={
                                'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] ' +
                                (active
                                    ? 'bg-clay-obsidian text-white'
                                    : 'bg-clay-surface text-clay-ink-muted')
                            }
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
    toast: ReturnType<typeof useToast>['toast'];
}) {
    const [pending, setPending] = React.useState(false);
    const formRef = React.useRef<HTMLFormElement>(null);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        (async () => {
            const res = await handleInviteAgent(null, fd);
            setPending(false);
            if (res.message) {
                toast({ title: 'Invitation sent', description: res.message });
                formRef.current?.reset();
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <ClayButton variant="obsidian" size="md" leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                    Invite member
                </ClayButton>
            </DialogTrigger>
            <DialogContent className="max-w-md overflow-hidden border border-clay-border bg-clay-surface p-0 shadow-clay-pop">
                <div className="h-[6px] w-full bg-clay-rose" />
                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-[20px] font-semibold tracking-[-0.01em] text-clay-ink">
                            Invite a teammate
                        </DialogTitle>
                        <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                            They'll receive a branded email with a one-click accept link valid for 7 days.
                        </p>
                    </DialogHeader>
                    <form ref={formRef} onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">
                                Email
                            </label>
                            <ClayInput
                                name="email"
                                type="email"
                                required
                                placeholder="teammate@company.com"
                                leading={<LuMail className="h-3.5 w-3.5" strokeWidth={2} />}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">
                                    Role
                                </label>
                                <ClaySelect
                                    name="role"
                                    defaultValue="agent"
                                    options={[
                                        { value: 'agent', label: 'Agent (default)' },
                                        { value: 'admin', label: 'Admin (full access)' },
                                        ...customRoles.map((r) => ({ value: r.id, label: r.name })),
                                    ]}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft">
                                    Project
                                </label>
                                <ClaySelect
                                    name="projectId"
                                    defaultValue=""
                                    options={[
                                        { value: '', label: 'All my projects' },
                                        ...projects.map((p) => ({
                                            value: p._id.toString(),
                                            label: p.name,
                                        })),
                                    ]}
                                />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                            <ClayButton
                                variant="pill"
                                size="md"
                                type="button"
                                onClick={() => onOpenChange(false)}
                                disabled={pending}
                            >
                                Cancel
                            </ClayButton>
                            <ClayButton
                                variant="obsidian"
                                size="md"
                                type="submit"
                                disabled={pending}
                                leading={
                                    pending ? (
                                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <LuUserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
                                    )
                                }
                            >
                                Send invitation
                            </ClayButton>
                        </div>
                    </form>
                </div>
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
    onRefresh: () => void;
    toast: ReturnType<typeof useToast>['toast'];
}) {
    if (loading) return <SkeletonRows />;
    if (!members.length) {
        return (
            <EmptyState
                title="No team members yet"
                body="Invite your first teammate to start collaborating across your projects."
                icon={<LuUsers className="h-5 w-5" strokeWidth={1.75} />}
            />
        );
    }
    return (
        <ClayCard padded={false} className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-clay-border bg-clay-surface-2 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft sm:grid-cols-[1fr_220px_160px_120px]">
                <span>Member</span>
                <span className="hidden sm:block">Projects & roles</span>
                <span className="hidden sm:block">Joined on</span>
                <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-clay-border">
                {members.map((m) => (
                    <MemberRow
                        key={m._id.toString()}
                        member={m}
                        projects={projects}
                        roleOptions={roleOptions}
                        roleLabel={roleLabel}
                        canEditRoles={canEditRoles}
                        canRemove={canRemove}
                        onRefresh={onRefresh}
                        toast={toast}
                    />
                ))}
            </div>
        </ClayCard>
    );
}

function MemberRow({
    member,
    projects,
    roleOptions,
    roleLabel,
    canEditRoles,
    canRemove,
    onRefresh,
    toast,
}: {
    member: MemberWithRoles;
    projects: WithId<Project>[];
    roleOptions: { value: string; label: string }[];
    roleLabel: (id: string) => string;
    canEditRoles: boolean;
    canRemove: boolean;
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
                toast({ title: 'Member removed', description: res.message });
                onRefresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        })();
    };

    return (
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_220px_160px_120px]">
            <div className="flex items-center gap-3 min-w-0">
                <Avatar name={member.name || member.email} seed={member.email} />
                <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-clay-ink">
                        {member.name || 'Unnamed member'}
                    </div>
                    <div className="truncate text-[12px] text-clay-ink-muted">{member.email}</div>
                </div>
            </div>

            <div className="hidden flex-wrap gap-1.5 sm:flex">
                {roleEntries.length === 0 ? (
                    <ClayBadge tone="neutral">No project roles</ClayBadge>
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
                    <ClayBadge tone="neutral">+{roleEntries.length - 3}</ClayBadge>
                ) : null}
            </div>

            <div className="hidden text-[12px] text-clay-ink-muted sm:block">
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
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <ClayButton
                            variant="ghost"
                            size="icon"
                            disabled={removing}
                            className="text-clay-red hover:bg-clay-red-soft/60"
                            aria-label="Remove member"
                        >
                            {removing ? (
                                <LuLoader className="h-4 w-4 animate-spin" />
                            ) : (
                                <LuTrash2 className="h-4 w-4" strokeWidth={1.75} />
                            )}
                        </ClayButton>
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
    toast: ReturnType<typeof useToast>['toast'];
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-clay-border bg-clay-surface-2 px-2.5 h-6 text-[11.5px] text-clay-ink">
                <span className="text-clay-ink-muted">{projectName}</span>
                <span className="text-clay-ink-soft">·</span>
                <span>{roleLabel(role)}</span>
            </span>
        );
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-clay-border bg-clay-surface-2 px-2.5 h-6 text-[11.5px] text-clay-ink hover:border-clay-border-strong hover:bg-clay-surface"
                >
                    <span className="text-clay-ink-muted">{projectName}</span>
                    <span className="text-clay-ink-soft">·</span>
                    <span>{roleLabel(role)}</span>
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm border border-clay-border bg-clay-surface p-6 shadow-clay-pop">
                <DialogHeader>
                    <DialogTitle className="text-[16px] font-semibold text-clay-ink">
                        Change role on {projectName}
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-3 flex flex-col gap-2">
                    {roleOptions.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            disabled={saving}
                            onClick={() => saveRole(r.value)}
                            className={
                                'flex items-center justify-between rounded-clay-md border border-clay-border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-clay-surface-2 ' +
                                (r.value === role ? 'bg-clay-rose-soft/40 border-clay-rose-soft' : '')
                            }
                        >
                            <span>{r.label}</span>
                            {r.value === role ? (
                                <LuCheck className="h-4 w-4 text-clay-rose-ink" strokeWidth={2.25} />
                            ) : null}
                        </button>
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
                title="No pending invitations"
                body="Any open invitations you send will show up here until the recipient accepts."
                icon={<LuMail className="h-5 w-5" strokeWidth={1.75} />}
            />
        );
    }
    return (
        <ClayCard padded={false} className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-clay-border bg-clay-surface-2 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-clay-ink-soft sm:grid-cols-[1.2fr_160px_140px_140px_140px]">
                <span>Invitee</span>
                <span className="hidden sm:block">Project</span>
                <span className="hidden sm:block">Role</span>
                <span className="hidden sm:block">Expires</span>
                <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-clay-border">
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
        </ClayCard>
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
                    <div className="truncate text-[13.5px] font-medium text-clay-ink">
                        {invite.inviteeEmail}
                    </div>
                    <div className="truncate text-[12px] text-clay-ink-muted">
                        Invited by {invite.inviterName || invite.inviterEmail || 'you'}
                    </div>
                </div>
            </div>

            <div className="hidden text-[12.5px] text-clay-ink sm:block">
                {invite.projectName || <span className="text-clay-ink-soft">All my projects</span>}
            </div>

            <div className="hidden sm:block">
                <ClayBadge tone="neutral">{roleLabel(invite.role)}</ClayBadge>
            </div>

            <div className="hidden sm:block">
                {expired ? (
                    <ClayBadge tone="red" dot>
                        Expired
                    </ClayBadge>
                ) : (
                    <ClayBadge tone="amber" dot>
                        {formatExpiresIn(invite.expiresAt)}
                    </ClayBadge>
                )}
            </div>

            <div className="flex items-center justify-end gap-1">
                <ClayButton
                    variant="ghost"
                    size="icon"
                    onClick={copyLink}
                    aria-label="Copy invite link"
                    title="Copy invite link"
                    disabled={!!busy}
                >
                    {busy === 'copy' ? (
                        <LuCheck className="h-4 w-4 text-clay-green" strokeWidth={2.25} />
                    ) : (
                        <LuArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ClayButton>
                <ClayButton
                    variant="ghost"
                    size="icon"
                    onClick={resend}
                    aria-label="Resend"
                    title="Resend email"
                    disabled={!!busy}
                >
                    {busy === 'resend' ? (
                        <LuLoader className="h-4 w-4 animate-spin" />
                    ) : (
                        <LuRefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ClayButton>
                <ClayButton
                    variant="ghost"
                    size="icon"
                    onClick={revoke}
                    aria-label="Revoke"
                    title="Revoke invitation"
                    disabled={!!busy}
                    className="text-clay-red hover:bg-clay-red-soft/60"
                >
                    {busy === 'revoke' ? (
                        <LuLoader className="h-4 w-4 animate-spin" />
                    ) : (
                        <LuX className="h-4 w-4" strokeWidth={1.75} />
                    )}
                </ClayButton>
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-clay-border text-[12px] font-semibold"
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
        <ClayCard padded={false}>
            <div className="divide-y divide-clay-border">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4">
                        <div className="h-9 w-9 animate-pulse rounded-full bg-clay-surface-2" />
                        <div className="flex flex-1 flex-col gap-1.5">
                            <div className="h-3 w-32 animate-pulse rounded-full bg-clay-surface-2" />
                            <div className="h-2.5 w-48 animate-pulse rounded-full bg-clay-surface-2" />
                        </div>
                        <div className="h-6 w-24 animate-pulse rounded-full bg-clay-surface-2" />
                    </div>
                ))}
            </div>
        </ClayCard>
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
        <ClayCard padded={false} className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
                {icon}
            </span>
            <div className="text-[16px] font-semibold text-clay-ink">{title}</div>
            <div className="max-w-[360px] text-[12.5px] text-clay-ink-muted">{body}</div>
        </ClayCard>
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
