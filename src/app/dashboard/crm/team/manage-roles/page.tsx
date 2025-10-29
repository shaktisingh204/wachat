
'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Save, KeyRound, ShieldCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getSession, saveCrmPermissions } from '@/app/actions/crm.actions';
import type { WithId, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function ManageRolesPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(saveCrmPermissions, initialState);
    const { toast } = useToast();

    useEffect(() => {
        startLoading(async () => {
            const session = await getSession();
            setUser(session?.user || null);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    if (isLoading || !user) {
        return <PageSkeleton />;
    }

    const permissions = user.crm?.permissions?.agent || {};
    const modules = [
        { id: 'contacts', name: 'Contacts' },
        { id: 'accounts', name: 'Accounts' },
        { id: 'deals', name: 'Deals' },
        { id: 'tasks', name: 'Tasks' },
    ];
    const actions = ['view', 'create', 'edit', 'delete'];

    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Agent Role Permissions</CardTitle>
                    <CardDescription>
                        Define what team members with the 'Agent' role can do within the CRM.
                        These settings apply to all agents across all your projects.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Module</TableHead>
                                    <TableHead className="text-center">View</TableHead>
                                    <TableHead className="text-center">Create</TableHead>
                                    <TableHead className="text-center">Edit</TableHead>
                                    <TableHead className="text-center">Delete</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modules.map(module => (
                                    <TableRow key={module.id}>
                                        <TableCell className="font-medium">{module.name}</TableCell>
                                        {actions.map(action => (
                                            <TableCell key={action} className="text-center">
                                                <Checkbox
                                                    name={`${module.id}_${action}`}
                                                    defaultChecked={(permissions[module.id as keyof typeof permissions] as any)?.[action] ?? false}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
