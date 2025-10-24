
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Database, Key, LoaderCircle, AlertCircle } from 'lucide-react';
import { getProjectById } from '@/app/actions';
import { saveDltAccount, deleteDltAccount } from '@/app/actions/sms.actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { WithId, Project, DltAccount } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
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


const dltProviders = [
    { id: 'airtel', name: 'Airtel DLT (DLTConnect)', endpoint: 'https://dltconnect.airtel.in/api/' },
    { id: 'jio', name: 'Jio DLT (TrueConnect)', endpoint: 'https://trueconnect.jio.com/api/' },
    { id: 'voda', name: 'Vi DLT (Vodafone Idea)', endpoint: 'https://www.vilpower.in/api/' },
    { id: 'bsnl', name: 'BSNL DLT Portal', endpoint: 'https://www.ucc-bsnl.co.in/api/' },
    { id: 'smartping', name: 'Smartping (PingConnect)', endpoint: 'https://pingconnect.in/api/' },
    { id: 'other', name: 'Other', endpoint: '' },
];

const saveInitialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
            Connect Account
        </Button>
    )
}

function DeleteButton({ dltAccountId, onDeleted }: { dltAccountId: string, onDeleted: () => void }) {
    const { activeProjectId } = useProject();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        if (!activeProjectId) return;
        startTransition(async () => {
            const result = await deleteDltAccount(activeProjectId, dltAccountId);
            if(result.success) {
                toast({ title: 'Success', description: 'DLT account removed.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete DLT Account?</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to remove this account? This will not affect your DLT registration.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function DltManagementPage() {
    const { activeProjectId, activeProject, reloadProject } = useProject();
    const [state, formAction] = useActionState(saveDltAccount, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [selectedProviderId, setSelectedProviderId] = useState('');
    
    const selectedProvider = dltProviders.find(p => p.id === selectedProviderId);
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            reloadProject(); // Re-fetch project data to show new DLT account
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, reloadProject]);
    
    if (!activeProjectId) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage DLT settings.</AlertDescription>
            </Alert>
        );
    }
    
    const connectedAccounts = activeProject?.smsProviderSettings?.dlt || [];

    return (
        <div className="space-y-8">
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={activeProjectId} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5"/>Add New DLT Account</CardTitle>
                        <CardDescription>Connect your registered DLT account to sync headers and templates.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="entityName">Entity Name</Label>
                                <Input id="entityName" name="entityName" placeholder="Your Registered Company Name" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dlt-provider">Select DLT Provider</Label>
                                <Select name="provider" onValueChange={setSelectedProviderId} required>
                                    <SelectTrigger id="dlt-provider"><SelectValue placeholder="Select a provider..."/></SelectTrigger>
                                    <SelectContent>
                                        {dltProviders.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="principal-id">Principal Entity ID</Label>
                            <Input id="principal-id" name="principalEntityId" placeholder="Your 19-digit DLT Principal Entity ID" required />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="api-key">API Key / Credentials</Label>
                                <Input id="api-key" name="apiKey" type="password" placeholder="Enter your API Key" required />
                            </div>
                            <div className="space-y-2">
                                <Label>API Endpoint</Label>
                                <Input value={selectedProvider?.endpoint || ''} disabled readOnly />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                       <SaveButton />
                    </CardFooter>
                </Card>
            </form>

            <Card>
                <CardHeader>
                     <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/>Manage Connected DLTs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Provider</TableHead>
                                <TableHead>Entity Name</TableHead>
                                <TableHead>Entity ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {connectedAccounts.length > 0 ? (
                                connectedAccounts.map(acc => (
                                    <TableRow key={acc._id.toString()}>
                                        <TableCell className="capitalize">{dltProviders.find(p => p.id === acc.provider)?.name || acc.provider}</TableCell>
                                        <TableCell>{acc.entityName}</TableCell>
                                        <TableCell>{acc.principalEntityId}</TableCell>
                                        <TableCell><Badge>{acc.status || 'Active'}</Badge></TableCell>
                                        <TableCell className="text-right">
                                             <DeleteButton dltAccountId={acc._id.toString()} onDeleted={reloadProject} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No DLT accounts connected yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
 
