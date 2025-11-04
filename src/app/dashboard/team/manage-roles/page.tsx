
'use client';

import { useActionState, useEffect, useTransition, useState, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Save, ShieldCheck, Settings, Plus, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getSession } from '@/app/actions/index.ts';
import { saveCrmPermissions, saveRole, deleteRole } from '@/app/actions/crm-roles.actions';
import type { WithId, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

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

function PageSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-80 w-full" />
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

const emailModules = [
    { id: 'campaigns', name: 'Campaigns' },
    { id: 'contacts', name: 'Email Contacts' },
    { id: 'templates', name: 'Email Templates' },
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

export default function ManageRolesPage() {
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
    
    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const allRoles = [{ id: 'agent', name: 'Agent', permissions: user.crm?.permissions?.agent }, ...(user.crm?.customRoles || [])];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <ShieldCheck className="h-8 w-8" />
                        Manage Team Roles
                    </h1>
                    <p className="text-muted-foreground">
                        Define what different roles can access and do across the platform.
                    </p>
                </div>
                <AddRoleDialog onRoleAdded={fetchUser} />
            </div>
            
            <form action={formAction}>
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
        </div>
    );
}
