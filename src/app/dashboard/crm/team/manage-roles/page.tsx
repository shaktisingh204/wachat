'use client';

import {
  ZoruAccordion,
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
  ZoruButton,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
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
  useCallback } from 'react';
import { LoaderCircle,
  Save,
  Plus,
  Trash2 } from 'lucide-react';
import { getSession } from '@/app/actions/user.actions';
import { saveRolePermissions,
  saveRole,
  deleteRole } from '@/app/actions/crm-roles.actions';
import type { WithId,
  User } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const initialState = { message: undefined, error: undefined };

function PageSkeleton() {
    return (
        <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-64" />
            <ZoruSkeleton className="h-4 w-96" />
            <ZoruSkeleton className="h-80 w-full" />
        </div>
    )
}

const crmModules = [
    { id: 'contacts', name: 'Contacts & Leads' },
    { id: 'accounts', name: 'Accounts (Companies)' },
    { id: 'deals', name: 'Deals Pipeline' },
    { id: 'tasks', name: 'Tasks' },
    { id: 'automations', name: 'Automations' },
    { id: 'reports', name: 'Reports' },
];

const actions = ['view', 'create', 'edit', 'delete'];

function AddRoleDialog({ onRoleAdded }: { onRoleAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [roleName, setRoleName] = useState('');
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const handleAddRole = async () => {
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
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton><Plus className="h-4 w-4" strokeWidth={1.75} />Add Role</ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Create New Role</ZoruDialogTitle>
                    <ZoruDialogDescription>Give your new role a name. You can set its permissions after creating it.</ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="py-4">
                    <ZoruLabel htmlFor="roleName">Role Name</ZoruLabel>
                    <ZoruInput id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                    <ZoruButton onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Create Role
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    )
}

function DeleteRoleButton({ role, onRoleDeleted }: { role: any, onRoleDeleted: () => void }) {
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
    }

    return (
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <ZoruButton variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-zoru-danger-ink" /></ZoruButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>This will permanently delete the &ldquo;{role.name}&rdquo; role. Team members with this role will lose their special permissions.</ZoruAlertDialogDescription>
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
    const { toast } = useZoruToast();

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

    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const customRolesWithPermissions = (user.crm?.customRoles || []).map(role => ({
        ...role,
        permissions: user.crm?.permissions?.[role.id]
    }));

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: user.crm?.permissions?.agent }, ...customRolesWithPermissions];

    return (
        <EntityListShell
            title="Manage Team Roles"
            subtitle="Define what different roles can access and do across the platform."
            primaryAction={<AddRoleDialog onRoleAdded={fetchUser} />}
        >

            <form action={formAction}>
                <ZoruAccordion type="single" collapsible className="w-full space-y-4">
                    {allRoles.map(role => {
                        const crmPermissions = role.permissions || {};

                        return (
                            <ZoruAccordionItem key={role.id} value={role.id} className="rounded-lg border border-zoru-line bg-zoru-bg">
                                <ZoruAccordionTrigger className="p-4 font-semibold text-[15px] hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        {role.name}
                                        {role.id !== 'agent' && <DeleteRoleButton role={role} onRoleDeleted={fetchUser} />}
                                    </div>
                                </ZoruAccordionTrigger>
                                <ZoruAccordionContent className="p-4 pt-0">
                                    <input type="hidden" name={`roleId`} value={role.id} />
                                    <ZoruTable>
                                        <ZoruTableHeader>
                                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                                <ZoruTableHead className="text-zoru-ink-muted">Module</ZoruTableHead>
                                                {actions.map(action => <ZoruTableHead key={action} className="text-center capitalize text-zoru-ink-muted">{action}</ZoruTableHead>)}
                                            </ZoruTableRow>
                                        </ZoruTableHeader>
                                        <ZoruTableBody>
                                            {crmModules.map(module => (
                                                <ZoruTableRow key={module.id} className="border-zoru-line">
                                                    <ZoruTableCell className="font-medium text-zoru-ink">{module.name}</ZoruTableCell>
                                                    {actions.map(action => (
                                                        <ZoruTableCell key={action} className="text-center">
                                                            <ZoruCheckbox
                                                                name={`${role.id}_${module.id}_${action}`}
                                                                defaultChecked={(crmPermissions[module.id as keyof typeof crmPermissions] as any)?.[action] ?? false}
                                                            />
                                                        </ZoruTableCell>
                                                    ))}
                                                </ZoruTableRow>
                                            ))}
                                        </ZoruTableBody>
                                    </ZoruTable>
                                </ZoruAccordionContent>
                            </ZoruAccordionItem>
                        )
                    })}
                </ZoruAccordion>
                <div className="flex justify-end mt-6">
                    <ZoruButton type="submit">
                        <Save className="h-4 w-4" strokeWidth={1.75} />
                        Save Permissions
                    </ZoruButton>
                </div>
            </form>
        </EntityListShell>
    );
}
