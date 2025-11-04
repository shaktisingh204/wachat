
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmDesignations, saveCrmDesignation, deleteCrmDesignation } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDesignation } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const saveInitialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Add Designation</Button>;
}

function DeleteButton({ designation, onDeleted }: { designation: WithId<CrmDesignation>, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmDesignation(designation._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Designation deleted.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }
    return <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}</Button>;
}

export default function DesignationsPage() {
    const [designations, setDesignations] = useState<WithId<CrmDesignation>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDesignation, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getCrmDesignations();
            setDesignations(data);
        });
    }, []);

    useEffect(() => { fetchData() }, [fetchData]);

    useEffect(() => {
        if (saveState.message) {
            toast({ title: 'Success', description: saveState.message });
            fetchData();
            formRef.current?.reset();
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, fetchData]);

    return (
        <div className="grid md:grid-cols-2 gap-8 items-start">
            <Card>
                <form action={formAction} ref={formRef}>
                    <CardHeader><CardTitle>Add New Designation</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="name">Designation Name</Label><Input id="name" name="name" required /></div>
                        <div className="space-y-2"><Label htmlFor="description">Description (Optional)</Label><Input id="description" name="description" /></div>
                    </CardContent>
                    <CardFooter><SaveButton /></CardFooter>
                </form>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Existing Designations</CardTitle>
                    <CardDescription>A list of all job titles in your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={2} className="text-center h-24"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                : designations.length > 0 ? designations.map(desig => (
                                    <TableRow key={desig._id.toString()}>
                                        <TableCell className="font-medium">{desig.name}</TableCell>
                                        <TableCell className="text-right"><DeleteButton designation={desig} onDeleted={fetchData} /></TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={2} className="text-center h-24">No designations created yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
