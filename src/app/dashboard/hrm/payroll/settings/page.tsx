'use client';

import { useActionState, useEffect, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { ListChecks, CalendarDays, Percent, Bell, Shield, Settings, LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { saveRolePermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import { getSession } from '@/app/actions/user.actions';
import type { User, WithId } from '@/lib/definitions';

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
    ZoruCard,
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
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const PlaceholderCard = ({ title, description }: { title: string, description: string }) => (
    <ZoruCard className="p-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                <Settings className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
            </div>
            <h3 className="text-[15px] text-zoru-ink">{title}</h3>
            <p className="text-[12.5px] text-zoru-ink-muted">{description}</p>
            <p className="mt-2 text-[11.5px] text-zoru-ink-muted">This feature is under development and will be available soon.</p>
        </div>
    </ZoruCard>
);

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Permissions
        </ZoruButton>
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
                <ZoruButton><Plus className="h-4 w-4" />Add Role</ZoruButton>
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

function AccessControlTab() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions as any, initialState as any);
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
        return <ZoruSkeleton className="h-96 w-full" />
    }

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: (user.crm || {}).permissions?.agent }, ...((user.crm || {}).customRoles || [])];

    return (
        <form action={formAction}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] text-zoru-ink">Roles & Permissions</h3>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </div>
            <ZoruAccordion type="single" collapsible className="w-full space-y-4">
                {allRoles.map(role => {
                    const crmPermissions = (role as any).permissions || {};

                    return (
                        <ZoruAccordionItem key={role.id} value={role.id} className="rounded-lg border border-zoru-line bg-zoru-bg">
                            <ZoruAccordionTrigger className="p-4 text-[14px] hover:no-underline">
                                <div className="flex items-center gap-2">
                                    {role.name}
                                    {role.id !== 'agent' && <DeleteRoleButton role={role} onRoleDeleted={fetchUser} />}
                                </div>
                            </ZoruAccordionTrigger>
                            <ZoruAccordionContent className="p-4 pt-0">
                                <input type="hidden" name={`roleId`} value={role.id} />
                                <ZoruTable>
                                    <ZoruTableHeader>
                                        <ZoruTableRow className="border-zoru-line">
                                            <ZoruTableHead className="text-zoru-ink-muted">Module</ZoruTableHead>
                                            {actions.map(action => <ZoruTableHead key={action} className="text-center capitalize text-zoru-ink-muted">{action}</ZoruTableHead>)}
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {crmModules.map(module => (
                                            <ZoruTableRow key={module.id} className="border-zoru-line">
                                                <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">{module.name}</ZoruTableCell>
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
            <div className="mt-6 flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}

export default function HrmSettingsPage() {
    const [activeTab, setActiveTab] = useState('access_control');
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="HRM Settings"
                subtitle="Configure payroll, attendance, leave, compliance, and notification rules for your organization."
                icon={Settings}
            />

            <ModuleLayout
                sidebar={
                    <ModuleSidebar
                        title="HRM Settings"
                        activeValue={activeTab}
                        onValueChange={setActiveTab}
                        items={[
                            { value: 'pay_cycle', label: 'Pay Cycle', icon: CalendarDays },
                            { value: 'attendance', label: 'Attendance', icon: ListChecks },
                            { value: 'leave_policy', label: 'Leave Policy', icon: CalendarDays },
                            { value: 'tax_deduction', label: 'Tax & Deductions', icon: Percent },
                            { value: 'notifications', label: 'Notifications', icon: Bell },
                            { value: 'access_control', label: 'Access Control', icon: Shield },
                        ]}
                    />
                }
            >
                {activeTab === 'pay_cycle' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Pay Cycle</h2>
                        <PlaceholderCard title="Pay Cycle Configuration" description="Define your company's pay period (e.g., monthly, weekly) and payroll processing dates." />
                    </div>
                )}
                {activeTab === 'attendance' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Attendance</h2>
                        <PlaceholderCard title="Attendance Rules" description="Set rules for late entry, early exit, overtime, and shift timings." />
                    </div>
                )}
                {activeTab === 'leave_policy' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Leave Policy</h2>
                        <PlaceholderCard title="Leave Policy Setup" description="Create and assign different leave types like Casual Leave (CL), Sick Leave (SL), and Paid Leave (PL)." />
                    </div>
                )}
                {activeTab === 'tax_deduction' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Tax & Deductions</h2>
                        <PlaceholderCard title="Tax & Deduction Rules" description="Manage formulas and rules for all statutory and custom deductions and allowances." />
                    </div>
                )}
                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Notifications</h2>
                        <PlaceholderCard title="Notification Settings" description="Configure email and SMS notification templates for HR-related events." />
                    </div>
                )}
                {activeTab === 'access_control' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] text-zoru-ink">Access Control</h2>
                        <AccessControlTab />
                    </div>
                )}
            </ModuleLayout>
        </div>
    );
}
