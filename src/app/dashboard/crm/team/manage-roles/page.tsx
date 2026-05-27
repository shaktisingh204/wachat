'use client';

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Button,
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
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { Download, LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { getSession } from '@/app/actions/user.actions';
import { saveRolePermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/**
 * Manage Roles — list page.
 *
 * Additions over the original:
 *  - Checkbox multi-select per role row (in the accordion header)
 *  - Bulk delete with confirm (only non-system roles)
 *  - Export CSV (role names + permission counts)
 */

const initialState = { message: undefined, error: undefined };

function PageSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-80 w-full" />
        </div>
    );
}

const permissionTree = [
    {
        id: 'crm',
        name: 'CRM Modules',
        children: [
            { id: 'contacts', name: 'Contacts & Leads', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'accounts', name: 'Accounts (Companies)', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'deals', name: 'Deals Pipeline', actions: ['view', 'create', 'edit', 'delete', 'change_stage'] }
        ]
    },
    {
        id: 'team',
        name: 'Team & Productivity',
        children: [
            { id: 'tasks', name: 'Tasks', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
            { id: 'team_chat', name: 'Team Chat', actions: ['view', 'create', 'edit', 'delete', 'manage_channels'] },
            { id: 'team_roles', name: 'Role Management', actions: ['view', 'create', 'edit', 'delete'] }
        ]
    },
    {
        id: 'system',
        name: 'System',
        children: [
            { id: 'automations', name: 'Automations', actions: ['view', 'create', 'edit', 'delete', 'execute'] },
            { id: 'reports', name: 'Reports', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'settings', name: 'CRM Settings', actions: ['view', 'edit', 'manage_billing'] }
        ]
    }
];

function countPermissions(permissions: Record<string, unknown>): number {
    let count = 0;
    for (const modulePerms of Object.values(permissions)) {
        if (modulePerms && typeof modulePerms === 'object') {
            for (const v of Object.values(modulePerms as Record<string, unknown>)) {
                if (v === true) count++;
            }
        }
    }
    return count;
}

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [roleName, setRoleName] = useState('');
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

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
            <ZoruDialogTrigger asChild>
                <Button><Plus className="h-4 w-4" strokeWidth={1.75} />Add Role</Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Create New Role</ZoruDialogTitle>
                    <ZoruDialogDescription>Give your new role a name. You can set its permissions after creating it.</ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="py-4">
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input
                        id="roleName"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                    />
                </div>
                <ZoruDialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Create Role
                    </Button>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

function DeleteRoleButton({
    role,
    onRoleDeleted,
}: {
    role: { id: string; name: string };
    onRoleDeleted: () => void;
}) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    if (role.id === 'agent') return null;

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteRole(role.id);
            if (result.success) {
                toast({ title: 'Success', description: 'Role deleted.' });
                onRoleDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                        This will permanently delete the &ldquo;{role.name}&rdquo; role. Team
                        members with this role will lose their special permissions.
                    </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
        </ZoruAlertDialog>
    );
}

export default function ManageRolesPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions, initialState);
    const [bulkPending, startBulkTransition] = useTransition();
    const { toast } = useZoruToast();

    // Search filter
    const [search, setSearch] = useState('');

    // Selection — tracks role ids (strings like 'agent' or custom uuids)
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

    const fetchUser = useCallback(() => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            fetchUser();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchUser]);

    const allRoles = useMemo(() => {
        if (!user) return [];
        const customRolesWithPermissions = (user.crm?.customRoles || []).map((role) => ({
            ...role,
            permissions: user.crm?.permissions?.[role.id] as Record<string, unknown> | undefined,
        }));
        return [
            {
                id: 'agent',
                name: 'Agent',
                permissions: user.crm?.permissions?.agent as Record<string, unknown> | undefined,
            },
            ...customRolesWithPermissions,
        ];
    }, [user]);

    // Filtered roles for display
    const filteredRoles = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allRoles;
        return allRoles.filter((r) => r.name.toLowerCase().includes(q));
    }, [allRoles, search]);

    // KPI derivations
    const totalRoles = allRoles.length;
    const systemRoles = allRoles.filter((r) => r.id === 'agent').length;
    const customRolesCount = allRoles.filter((r) => r.id !== 'agent').length;
    const mostUsedRole = useMemo(() => {
        // Most-used = role with highest permission count as a proxy
        let best = allRoles[0];
        for (const r of allRoles) {
            if (countPermissions(r.permissions ?? {}) > countPermissions(best?.permissions ?? {})) {
                best = r;
            }
        }
        return best?.name ?? '—';
    }, [allRoles]);

    // Only non-system roles can be bulk-deleted
    const customRoleIds = useMemo(
        () => allRoles.filter((r) => r.id !== 'agent').map((r) => r.id),
        [allRoles],
    );
    const selectedIds = useMemo(
        () => [...selected].filter((id) => customRoleIds.includes(id)),
        [selected, customRoleIds],
    );
    const hasSelection = selectedIds.length > 0;

    const toggleOne = (id: string) => {
        if (id === 'agent') return; // system role — not selectable
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allCustomChecked =
        customRoleIds.length > 0 && customRoleIds.every((id) => selected.has(id));
    const someCustomChecked = customRoleIds.some((id) => selected.has(id));

    const toggleAllCustom = () => {
        if (allCustomChecked) {
            setSelected((prev) => {
                const next = new Set(prev);
                customRoleIds.forEach((id) => next.delete(id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                customRoleIds.forEach((id) => next.add(id));
                return next;
            });
        }
    };

    // Bulk delete — fire sequentially, fail fast on first error
    const handleBulkDelete = () => {
        startBulkTransition(async () => {
            let count = 0;
            for (const id of selectedIds) {
                const res = await deleteRole(id);
                if (!res.success) {
                    toast({ title: 'Partial failure', description: res.error, variant: 'destructive' });
                    break;
                }
                count++;
            }
            if (count > 0) {
                toast({ title: `${count} role(s) deleted` });
                setSelected(new Set());
                fetchUser();
            }
            setBulkDeleteOpen(false);
        });
    };

    // Export CSV: role name + permission count (no actual perm values)
    const handleExport = () => {
        const exportRows = allRoles.map((r) => ({
            'Role name': r.name,
            'Role ID': r.id,
            'Is system': r.id === 'agent' ? 'Yes' : 'No',
            'Permission count': countPermissions(r.permissions ?? {}),
        }));
        downloadCsv(
            `roles-${dateStamp()}.csv`,
            Object.keys(exportRows[0] ?? {}),
            exportRows,
        );
        toast({ title: 'CSV exported' });
    };

    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    return (
        <EntityListShell
            title="Manage Team Roles"
            subtitle="Define what different roles can access and do across the platform."
            primaryAction={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        disabled={allRoles.length === 0}
                    >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <AddRoleDialog onRoleAdded={fetchUser} />
                </div>
            }
            search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search by role name…',
            }}
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                <StatCard label="Total roles" value={totalRoles.toLocaleString()} />
                <StatCard label="System roles" value={systemRoles.toLocaleString()} />
                <StatCard label="Custom roles" value={customRolesCount.toLocaleString()} />
                <StatCard label="Most permissions" value={mostUsedRole} />
            </div>

            {/* Bulk selection header for custom roles */}
            {customRoleIds.length > 0 && (
                <div className="mb-3 flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zoru-ink-muted">
                        <Checkbox
                            checked={allCustomChecked}
                            aria-checked={someCustomChecked && !allCustomChecked ? 'mixed' : allCustomChecked}
                            onCheckedChange={toggleAllCustom}
                            aria-label="Select all custom roles"
                        />
                        Select all custom roles
                    </label>
                </div>
            )}

            {/* Bulk action bar */}
            {hasSelection && (
                <div className="mb-3 flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2/40 px-4 py-2.5 text-sm">
                    <span className="font-medium text-zoru-ink">
                        {selectedIds.length} selected
                    </span>
                    <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={bulkPending}
                            onClick={() => setBulkDeleteOpen(true)}
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete selected
                        </Button>
                        <ZoruAlertDialogContent>
                            <ZoruAlertDialogHeader>
                                <ZoruAlertDialogTitle>
                                    Delete {selectedIds.length} role(s)?
                                </ZoruAlertDialogTitle>
                                <ZoruAlertDialogDescription>
                                    Team members with these roles will lose their special
                                    permissions. System roles (Agent) are never deleted.
                                </ZoruAlertDialogDescription>
                            </ZoruAlertDialogHeader>
                            <ZoruAlertDialogFooter>
                                <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                <ZoruAlertDialogAction
                                    onClick={handleBulkDelete}
                                    disabled={bulkPending}
                                >
                                    {bulkPending ? (
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Delete
                                </ZoruAlertDialogAction>
                            </ZoruAlertDialogFooter>
                        </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(new Set())}
                    >
                        Clear selection
                    </Button>
                </div>
            )}

            <form action={formAction}>
                <Accordion type="single" collapsible className="w-full space-y-4">
                    {filteredRoles.map((role) => {
                        const crmPermissions = (role.permissions || {}) as Record<string, Record<string, boolean>>;
                        const isSystem = role.id === 'agent';

                        return (
                            <ZoruAccordionItem
                                key={role.id}
                                value={role.id}
                                className="rounded-lg border border-zoru-line bg-zoru-bg"
                            >
                                <ZoruAccordionTrigger className="p-4 font-semibold text-[15px] hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        {!isSystem && (
                                            <Checkbox
                                                checked={selected.has(role.id)}
                                                onCheckedChange={() => toggleOne(role.id)}
                                                aria-label={`Select ${role.name}`}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                        <span>{role.name}</span>
                                        {!isSystem && (
                                            <DeleteRoleButton role={role} onRoleDeleted={fetchUser} />
                                        )}
                                    </div>
                                </ZoruAccordionTrigger>
                                <ZoruAccordionContent className="p-4 pt-0">
                                    <input type="hidden" name="roleId" value={role.id} />
                                    <div className="flex flex-col gap-6">
                                        {permissionTree.map((category) => (
                                            <div key={category.id} className="border border-zoru-line rounded-lg p-4 bg-zoru-surface-2/10">
                                                <h4 className="font-semibold text-sm mb-4 text-zoru-ink-muted uppercase tracking-wider">{category.name}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {category.children.map((module) => (
                                                        <div key={module.id} className="flex flex-col gap-2 bg-zoru-surface p-3 rounded-md border border-zoru-line shadow-sm">
                                                            <span className="font-medium text-[13.5px] text-zoru-ink border-b border-zoru-line pb-2 mb-1">{module.name}</span>
                                                            <div className="flex flex-col gap-2">
                                                                {module.actions.map((action) => {
                                                                    const fieldName = `${role.id}_${module.id}_${action}`;
                                                                    const isChecked = crmPermissions[module.id]?.[action] ?? false;
                                                                    return (
                                                                        <label key={action} className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink cursor-pointer group">
                                                                            <Checkbox
                                                                                name={fieldName}
                                                                                defaultChecked={isChecked}
                                                                                className="transition-colors data-[state=checked]:bg-zoru-ink data-[state=checked]:border-primary"
                                                                            />
                                                                            <span className="capitalize group-hover:underline decoration-muted-foreground/30 underline-offset-2">{action.replace('_', ' ')}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ZoruAccordionContent>
                            </ZoruAccordionItem>
                        );
                    })}
                </Accordion>
                <div className="mt-6 flex justify-end">
                    <Button type="submit">
                        <Save className="h-4 w-4" strokeWidth={1.75} />
                        Save Permissions
                    </Button>
                </div>
            </form>
        </EntityListShell>
    );
}
