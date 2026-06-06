'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, cn, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ShieldCheck,
  Plus,
  Save,
  Trash2,
  LoaderCircle,
  ChevronDown,
  Check,
  } from 'lucide-react';

import { getSession } from '@/app/actions/user.actions';
import {
    saveRolePermissions,
    saveRole,
    deleteRole,
} from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';
import { moduleCategories } from '@/lib/permission-modules';

const initialState = { message: undefined, error: undefined } as {
    message?: string;
    error?: string;
};

const actions = ['view', 'create', 'edit', 'delete'] as const;

const permissionCategories = Object.entries(moduleCategories).reduce((acc, [label, modules]) => {
    acc[label] = {
        label,
        modules: modules.map(m => {
            const name = m
                .split(/[_.]/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            return { id: m, name };
        })
    };
    return acc;
}, {} as Record<string, { label: string; modules: Array<{ id: string; name: string }> }>);


/* ── Sticky save bar ─────────────────────────────────────────────── */

function SaveBar() {
    const { pending } = useFormStatus();
    return (
        <div className="sticky bottom-4 z-20 mt-6 flex items-center justify-between rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)]/95 p-3 shadow-md backdrop-blur">
            <p className="pl-2 text-[12.5px] text-[var(--st-text-secondary)]">
                Toggle permissions for every role, then save to sync all members.
            </p>
            <Button type="submit" size="md" disabled={pending}>
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {pending ? 'Saving…' : 'Save permissions'}
            </Button>
        </div>
    );
}

/* ── Skeleton ────────────────────────────────────────────────────── */

function PageSkeleton() {
    return (
        <div className="flex min-h-full flex-col gap-6">
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
    );
}

/* ── Add role dialog ─────────────────────────────────────────────── */

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [roleName, setRoleName] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleAddRole = () => {
        if (!roleName.trim()) {
            toast({ title: 'Error', description: 'Role name cannot be empty.', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await saveRole({ id: '', name: roleName, permissions: {} });
            if (result.success) {
                toast({ title: 'Success', description: 'New role created.' });
                onRoleAdded();
                setOpen(false);
                setRoleName('');
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="h-4 w-4" />
                    New role
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a new role</DialogTitle>
                    <DialogDescription>
                        Give the role a name. You can configure permissions once it appears in the list.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <Label htmlFor="roleName" className="mb-1.5 block text-[12.5px] text-[var(--st-text)]">
                        Role name
                    </Label>
                    <Input
                        id="roleName"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="e.g. Marketing Manager"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Create role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ── Delete role button ──────────────────────────────────────────── */

function DeleteRoleButton({ role, onRoleDeleted }: { role: { id: string; name: string }; onRoleDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    if (role.id === 'agent') return null;

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteRole(role.id);
            if (result.success) {
                toast({ title: 'Role deleted' });
                onRoleDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-danger)] hover:text-[var(--st-danger)]"
                    aria-label={`Delete ${role.name}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete role?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently removes the &ldquo;{role.name}&rdquo; role. Members assigned to it will
                        lose these permissions immediately.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending}
                        className="bg-[var(--st-danger)] text-[var(--st-text-inverted)] hover:bg-[var(--st-danger)]/90"
                    >
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/* ── Role card (accordion-style) ─────────────────────────────────── */

type RolePerms = Record<string, Partial<Record<(typeof actions)[number], boolean>>>;
type RoleRow = { id: string; name: string; permissions: RolePerms };

function RoleCard({
    role,
    defaultOpen,
    onRoleDeleted,
}: {
    role: RoleRow;
    defaultOpen: boolean;
    onRoleDeleted: () => void;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [activeCategory, setActiveCategory] = useState<string>(Object.keys(permissionCategories)[0]);
    const [perms, setPerms] = useState<RolePerms>(role.permissions || {});

    const enabledCount = useMemo(() => {
        let n = 0;
        for (const mod of Object.values(perms)) {
            if (!mod) continue;
            for (const a of actions) if (mod[a]) n += 1;
        }
        return n;
    }, [perms]);

    return (
        <Card className="overflow-hidden p-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
                    open ? 'bg-[var(--st-bg-muted)]/50' : 'hover:bg-[var(--st-bg-muted)]/40',
                )}
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[14px] text-[var(--st-text)]">{role.name}</p>
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            {enabledCount} permission{enabledCount === 1 ? '' : 's'} granted
                        </p>
                    </div>
                    {role.id === 'agent' && <Badge variant="ghost">System</Badge>}
                </div>
                <div className="flex items-center gap-2">
                    <DeleteRoleButton role={role} onRoleDeleted={onRoleDeleted} />
                    <ChevronDown
                        className={cn('h-5 w-5 text-[var(--st-text-secondary)] transition-transform', open && 'rotate-180')}
                    />
                </div>
            </button>

            {open && (
                <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)]">
                    <input type="hidden" name="roleId" value={role.id} />
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
                        <aside className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-2 md:border-b-0 md:border-r">
                            <div className="flex gap-2 overflow-x-auto md:flex-col">
                                {Object.entries(permissionCategories).map(([key, cat]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setActiveCategory(key)}
                                        className={cn(
                                            'shrink-0 rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors md:w-full',
                                            activeCategory === key
                                                ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg)] hover:text-[var(--st-text)]',
                                        )}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </aside>
                        <div className="p-5">
                            {Object.entries(permissionCategories).map(([key, cat]) => {
                                if (key !== activeCategory) return null;
                                return (
                                    <div key={key} className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[13.5px] text-[var(--st-text)]">
                                                {cat.label} permissions
                                            </h3>
                                            <Badge variant="ghost">
                                                {cat.modules.length} modules
                                            </Badge>
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-[var(--st-border)]">
                                            <div className="grid grid-cols-[minmax(180px,2fr)_repeat(4,80px)] gap-0 bg-[var(--st-bg-muted)]/50 px-4 py-2.5 text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                                <span>Module</span>
                                                {actions.map((a) => {
                                                    const allChecked = cat.modules.every(m => perms[m.id]?.[a]);
                                                    const someChecked = cat.modules.some(m => perms[m.id]?.[a]);
                                                    return (
                                                    <div key={a} className="flex items-center justify-center gap-1">
                                                        <Checkbox
                                                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                                            onCheckedChange={(val) => {
                                                                const newVal = val === true || val === 'indeterminate';
                                                                setPerms(prev => {
                                                                    const next = { ...prev };
                                                                    cat.modules.forEach(m => {
                                                                        next[m.id] = { ...(next[m.id] || {}), [a]: newVal };
                                                                    });
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <span className="text-center capitalize">{a}</span>
                                                    </div>
                                                )})}
                                            </div>
                                            <div className="divide-y divide-[var(--st-border)]">
                                                {cat.modules.map((mod) => (
                                                    <div
                                                        key={mod.id}
                                                        className="grid grid-cols-[minmax(180px,2fr)_repeat(4,80px)] items-center px-4 py-2.5 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/40"
                                                    >
                                                        <span>{mod.name}</span>
                                                        {actions.map((action) => (
                                                            <div key={action} className="flex justify-center">
                                                                <Checkbox
                                                                    name={`${role.id}_${mod.id}_${action}`}
                                                                    checked={perms[mod.id]?.[action] ?? false}
                                                                    onCheckedChange={(val) => {
                                                                        setPerms(prev => ({
                                                                            ...prev,
                                                                            [mod.id]: {
                                                                                ...(prev[mod.id] || {}),
                                                                                [action]: val === true
                                                                            }
                                                                        }));
                                                                    }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function ManageRolesPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions, initialState);
    const { toast } = useToast();

    const fetchUser = () => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    };

    useEffect(() => {
        fetchUser();
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            fetchUser();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const allRoles: RoleRow[] = [
        { id: 'agent', name: 'Agent', permissions: (user.crm?.permissions as any)?.agent ?? {} },
        ...(((user.crm?.customRoles ?? []) as any[]).map((r) => ({
            id: r.id,
            name: r.name,
            permissions: r.permissions ?? {},
        }))),
    ];

    const totalGranted = allRoles.reduce((sum, r) => {
        let n = 0;
        for (const mod of Object.values(r.permissions || {})) {
            for (const a of actions) if ((mod as any)?.[a]) n += 1;
        }
        return sum + n;
    }, 0);

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/team">Team</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Roles & permissions</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <PageTitle>Roles & permissions</PageTitle>
                    <PageDescription>
                        Define what each role can access and do across every module of the platform.
                    </PageDescription>
                </PageHeading>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">Roles</p>
                    <p className="mt-1 text-[22px] text-[var(--st-text)]">{allRoles.length}</p>
                </Card>
                <Card variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        Permissions granted
                    </p>
                    <p className="mt-1 text-[22px] text-[var(--st-text)]">{totalGranted}</p>
                </Card>
                <Card variant="soft" className="p-6">
                    <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                        Modules covered
                    </p>
                    <p className="mt-1 text-[22px] text-[var(--st-text)]">
                        {Object.values(permissionCategories).reduce((n, c) => n + c.modules.length, 0)}
                    </p>
                </Card>
            </div>

            <form action={formAction} className="flex flex-1 flex-col">
                <div className="flex flex-1 flex-col gap-3">
                    {allRoles.map((role, idx) => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            defaultOpen={idx === 0}
                            onRoleDeleted={fetchUser}
                        />
                    ))}
                </div>
                <SaveBar />
            </form>

            <Card variant="soft" className="flex items-start gap-3 p-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)] text-[var(--st-bg)]">
                    <Check className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[13px] text-[var(--st-text)]">How permissions apply</p>
                    <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                        Changes take effect immediately. Members with a role pick up the updated module
                        access on their next navigation. System roles (e.g. Agent) cannot be deleted,
                        but their permissions can still be tuned per module.
                    </p>
                </div>
            </Card>
        </div>
    );
}
