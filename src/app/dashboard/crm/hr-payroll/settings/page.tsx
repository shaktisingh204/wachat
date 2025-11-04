
'use client';

import { useActionState, useEffect, useState, useTransition, useCallback, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, CalendarDays, Percent, Bell, Shield, Settings, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { saveCrmPermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import { getSession } from '@/app/actions/index.ts';
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

const PlaceholderCard = ({ title, description }: { title: string, description: string }) => (
    <Card className="text-center py-16">
        <CardHeader>
            <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                <Settings className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This feature is under development and will be available soon.</p>
        </CardContent>
    </Card>
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
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>Add Role</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>Give your new role a name. You can set its permissions after creating it.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddRole} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
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
                <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete the "{role.name}" role. Team members with this role will lose their special permissions.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AccessControlTab() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveCrmPermissions, initialState);
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
            fetchUser(); // Refetch user to get the latest permissions
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchUser]);

    if(isLoading || !user) {
        return <Skeleton className="h-96 w-full" />
    }

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: (user.crm || {}).permissions?.agent }, ...((user.crm || {}).customRoles || [])];

    return (
        <form action={formAction}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Roles & Permissions</h3>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </div>
             <Accordion type="single" collapsible className="w-full space-y-4">
                 {allRoles.map(role => {
                     const crmPermissions = role.permissions || {};

                     return (
                        <AccordionItem key={role.id} value={role.id} className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
                                <div className="flex items-center gap-2">
                                    {role.name}
                                    {role.id !== 'agent' && <DeleteRoleButton role={role} onRoleDeleted={fetchUser} />}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                 <input type="hidden" name={`roleId`} value={role.id} />
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Module</TableHead>
                                            {actions.map(action => <TableHead key={action} className="text-center capitalize">{action}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {crmModules.map(module => (
                                            <TableRow key={module.id}>
                                                <TableCell className="font-medium">{module.name}</TableCell>
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
             <div className="flex justify-end mt-6">
                <SubmitButton />
             </div>
        </form>
    );
}

export default function HrmSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Settings className="h-8 w-8" />
                        HRM Settings
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Configure payroll, attendance, leave, compliance, and notification rules for your organization.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="access_control" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    <TabsTrigger value="pay_cycle"><CalendarDays className="mr-2 h-4 w-4"/>Pay Cycle</TabsTrigger>
                    <TabsTrigger value="attendance"><ListChecks className="mr-2 h-4 w-4"/>Attendance</TabsTrigger>
                    <TabsTrigger value="leave_policy"><CalendarDays className="mr-2 h-4 w-4"/>Leave Policy</TabsTrigger>
                    <TabsTrigger value="tax_deduction"><Percent className="mr-2 h-4 w-4"/>Tax & Deductions</TabsTrigger>
                    <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4"/>Notifications</TabsTrigger>
                    <TabsTrigger value="access_control"><Shield className="mr-2 h-4 w-4"/>Access Control</TabsTrigger>
                </TabsList>
                <TabsContent value="pay_cycle" className="mt-6">
                    <PlaceholderCard title="Pay Cycle Configuration" description="Define your company's pay period (e.g., monthly, weekly) and payroll processing dates." />
                </TabsContent>
                <TabsContent value="attendance" className="mt-6">
                    <PlaceholderCard title="Attendance Rules" description="Set rules for late entry, early exit, overtime, and shift timings." />
                </TabsContent>
                <TabsContent value="leave_policy" className="mt-6">
                    <PlaceholderCard title="Leave Policy Setup" description="Create and assign different leave types like Casual Leave (CL), Sick Leave (SL), and Paid Leave (PL)." />
                </TabsContent>
                <TabsContent value="tax_deduction" className="mt-6">
                    <PlaceholderCard title="Tax & Deduction Rules" description="Manage formulas and rules for all statutory and custom deductions and allowances." />
                </TabsContent>
                <TabsContent value="notifications" className="mt-6">
                    <PlaceholderCard title="Notification Settings" description="Configure email and SMS notification templates for HR-related events." />
                </TabsContent>
                <TabsContent value="access_control" className="mt-6">
                     <AccessControlTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
