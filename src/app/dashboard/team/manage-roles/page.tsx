
'use client';

import { useActionState, useEffect, useTransition, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Save, ShieldCheck, Settings } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getSession } from '@/app/actions';
import { saveCrmPermissions } from '@/app/actions/crm.actions';
import type { WithId, User } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

    const crmPermissions = user.crm?.permissions?.agent || {};
    const emailPermissions = user.email?.permissions?.agent || {};


    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8" />
                    Manage Team Roles
                </h1>
                <p className="text-muted-foreground">
                    Define what different roles can access and do across the platform.
                </p>
            </div>
            <form action={formAction}>
                <Card>
                    <CardHeader>
                        <CardTitle>Role: Agent</CardTitle>
                        <CardDescription>
                            Set the permissions for team members assigned the "Agent" role.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={['crm']} className="w-full space-y-4">
                            <AccordionItem value="crm" className="border rounded-lg">
                                <AccordionTrigger className="p-4 font-semibold">CRM Suite Permissions</AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
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
                                                                name={`crm_${module.id}_${action}`}
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

                            <AccordionItem value="email" className="border rounded-lg">
                                <AccordionTrigger className="p-4 font-semibold">Email Suite Permissions</AccordionTrigger>
                                 <AccordionContent className="p-4 pt-0">
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Module</TableHead>
                                                {actions.map(action => <TableHead key={action} className="text-center capitalize">{action}</TableHead>)}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {emailModules.map(module => (
                                                <TableRow key={module.id}>
                                                    <TableCell className="font-medium">{module.name}</TableCell>
                                                    {actions.map(action => (
                                                        <TableCell key={action} className="text-center">
                                                            <Checkbox
                                                                name={`email_${module.id}_${action}`}
                                                                defaultChecked={(emailPermissions[module.id as keyof typeof emailPermissions] as any)?.[action] ?? false}
                                                            />
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                     <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
