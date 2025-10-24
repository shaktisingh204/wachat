
'use client';

import { useState, useEffect, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/context/project-context";
import { getSmsHeaders, saveSmsHeader, deleteSmsHeader } from "@/app/actions/sms.actions";
import type { WithId, SmsHeader } from "@/lib/definitions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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


const saveInitialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Header
        </Button>
    )
}

function DeleteButton({ header, onDeleted }: { header: WithId<SmsHeader>, onDeleted: () => void }) {
    const { activeProjectId } = useProject();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        if (!activeProjectId) return;
        startTransition(async () => {
            const result = await deleteSmsHeader(activeProjectId, header._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Header deleted.' });
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
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will delete the header "{header.name}".</AlertDialogDescription>
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


export default function HeaderManagementPage() {
    const { activeProjectId, activeProject } = useProject();
    const [headers, setHeaders] = useState<WithId<SmsHeader>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [state, formAction] = useActionState(saveSmsHeader, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    
    const fetchHeaders = useCallback(() => {
        if (activeProjectId) {
            startLoadingTransition(async () => {
                const data = await getSmsHeaders(activeProjectId);
                setHeaders(data);
            });
        }
    }, [activeProjectId]);
    
    useEffect(() => {
        fetchHeaders();
    }, [fetchHeaders]);
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            fetchHeaders();
            formRef.current?.reset();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchHeaders]);

    if (!activeProjectId) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage DLT settings.</AlertDescription>
            </Alert>
        );
    }

    const getStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const s = status.toLowerCase();
        if (s === 'approved') return 'default';
        if (s === 'pending') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <form action={formAction} ref={formRef}>
                        <input type="hidden" name="projectId" value={activeProjectId} />
                        <CardHeader>
                            <CardTitle>Add New Header</CardTitle>
                            <CardDescription>Register a new Sender ID for approval on the DLT portal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Header (Sender ID)</Label>
                                <Input id="name" name="name" required maxLength={6} placeholder="e.g. SABNOD" />
                                <p className="text-xs text-muted-foreground">6 characters, alphabetic. Should match your registered header.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Header Type</Label>
                                <Select name="type" required>
                                    <SelectTrigger id="type"><SelectValue placeholder="Select type..."/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Promotional">Promotional</SelectItem>
                                        <SelectItem value="Transactional">Transactional</SelectItem>
                                        <SelectItem value="Service">Service</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SaveButton />
                        </CardFooter>
                    </form>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Map Headers to Templates</CardTitle>
                        <CardDescription>Associate your approved headers with specific message templates.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-8">This feature is coming soon.</p>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Header Status</CardTitle>
                    <CardDescription>A list of all your registered headers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Header</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center"><LoaderCircle className="mx-auto animate-spin"/></TableCell></TableRow>
                            ) : headers.length > 0 ? (
                                headers.map(header => (
                                    <TableRow key={header._id.toString()}>
                                        <TableCell className="font-mono font-semibold">{header.name}</TableCell>
                                        <TableCell>{header.type}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(header.status)}>{header.status}</Badge></TableCell>
                                        <TableCell>{format(new Date(header.createdAt), 'PPP')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                            <DeleteButton header={header} onDeleted={fetchHeaders} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No headers added yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
