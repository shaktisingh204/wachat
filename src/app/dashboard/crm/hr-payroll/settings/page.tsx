'use client';

import { useActionState, useEffect, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { ListChecks, CalendarDays, Percent, Bell, Shield, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { saveRolePermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import { getSession } from '@/app/actions/user.actions';
import type { User, WithId } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { LoaderCircle, Save, Plus, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const PlaceholderCard = ({ title, description }: { title: string, description: string }) => (
    <ClayCard>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                <Settings className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <h3 className="text-[15px] font-semibold text-clay-ink">{title}</h3>
            <p className="text-[12.5px] text-clay-ink-muted">{description}</p>
            <p className="mt-2 text-[11.5px] text-clay-ink-muted">This feature is under development and will be available soon.</p>
        </div>
    </ClayCard>
);

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Permissions
        </Button>
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
    const { toast } = useToast();
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" />}>Add Role</ClayButton>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>Give your new role a name. You can set its permissions after creating it.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                        Create Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DeleteRoleButton({ role, onRoleDeleted }: { role: any, onRoleDeleted: () => void }) {
    const { toast } = useToast();
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
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the &ldquo;{role.name}&rdquo; role. Team members with this role will lose their special permissions.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AccessControlTab() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveRolePermissions as any, initialState as any);
    const { toast } = useToast();

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
        return <Skeleton className="h-96 w-full" />
    }

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: (user.crm || {}).permissions?.agent }, ...((user.crm || {}).customRoles || [])];

    return (
        <form action={formAction}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-clay-ink">Roles & Permissions</h3>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </div>
            <Accordion type="single" collapsible className="w-full space-y-4">
                {allRoles.map(role => {
                    const crmPermissions = (role as any).permissions || {};

                    return (
                        <AccordionItem key={role.id} value={role.id} className="rounded-clay-md border border-clay-border bg-clay-surface">
                            <AccordionTrigger className="p-4 text-[14px] font-semibold hover:no-underline">
                                <div className="flex items-center gap-2">
                                    {role.name}
                                    {role.id !== 'agent' && <DeleteRoleButton role={role} onRoleDeleted={fetchUser} />}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <input type="hidden" name={`roleId`} value={role.id} />
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-clay-border">
                                            <TableHead className="text-clay-ink-muted">Module</TableHead>
                                            {actions.map(action => <TableHead key={action} className="text-center capitalize text-clay-ink-muted">{action}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {crmModules.map(module => (
                                            <TableRow key={module.id} className="border-clay-border">
                                                <TableCell className="text-[13px] font-medium text-clay-ink">{module.name}</TableCell>
                                                {actions.map(action => (
                                                    <TableCell key={action} className="text-center">
                                                        <Checkbox
                                                            name={`${role.id}_${module.id}_${action}`}
                                                            defaultChecked={(crmPermissions[module.id as keyof typeof crmPermissions] as any)?.[action] ?? false}
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
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
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Pay Cycle</h2>
                        <PlaceholderCard title="Pay Cycle Configuration" description="Define your company's pay period (e.g., monthly, weekly) and payroll processing dates." />
                    </div>
                )}
                {activeTab === 'attendance' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Attendance</h2>
                        <PlaceholderCard title="Attendance Rules" description="Set rules for late entry, early exit, overtime, and shift timings." />
                    </div>
                )}
                {activeTab === 'leave_policy' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Leave Policy</h2>
                        <PlaceholderCard title="Leave Policy Setup" description="Create and assign different leave types like Casual Leave (CL), Sick Leave (SL), and Paid Leave (PL)." />
                    </div>
                )}
                {activeTab === 'tax_deduction' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Tax & Deductions</h2>
                        <PlaceholderCard title="Tax & Deduction Rules" description="Manage formulas and rules for all statutory and custom deductions and allowances." />
                    </div>
                )}
                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Notifications</h2>
                        <PlaceholderCard title="Notification Settings" description="Configure email and SMS notification templates for HR-related events." />
                    </div>
                )}
                {activeTab === 'access_control' && (
                    <div className="space-y-6">
                        <h2 className="text-[20px] font-semibold tracking-tight text-clay-ink">Access Control</h2>
                        <AccessControlTab />
                    </div>
                )}
            </ModuleLayout>
        </div>
    );
}
