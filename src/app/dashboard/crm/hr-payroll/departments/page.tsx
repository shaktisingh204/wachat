'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Trash2, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmDepartments, saveCrmDepartment, deleteCrmDepartment } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDepartment } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Add Department
        </ClayButton>
    );
}

function DeleteButton({ department, onDeleted }: { department: WithId<CrmDepartment>, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmDepartment(department._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Department deleted.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }
    return <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}</Button>;
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDepartment, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getCrmDepartments();
            setDepartments(data);
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Departments"
                subtitle="Organize your team into departments."
                icon={Building}
            />

            <div className="grid items-start gap-6 md:grid-cols-2">
                <ClayCard>
                    <form action={formAction} ref={formRef}>
                        <div className="mb-4">
                            <h2 className="text-[16px] font-semibold text-clay-ink">Add New Department</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2"><Label htmlFor="name" className="text-[13px] text-clay-ink">Department Name</Label><Input id="name" name="name" required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            <div className="space-y-2"><Label htmlFor="description" className="text-[13px] text-clay-ink">Description (Optional)</Label><Input id="description" name="description" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                        </div>
                        <div className="mt-6"><SaveButton /></div>
                    </form>
                </ClayCard>
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-clay-ink">Existing Departments</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">The list of all departments in your organization.</p>
                    </div>
                    <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                        <Table>
                            <TableHeader><TableRow className="border-clay-border hover:bg-transparent"><TableHead className="text-clay-ink-muted">Name</TableHead><TableHead className="text-right text-clay-ink-muted">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow className="border-clay-border"><TableCell colSpan={2} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                                : departments.length > 0 ? departments.map(dept => (
                                    <TableRow key={dept._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{dept.name}</TableCell>
                                        <TableCell className="text-right"><DeleteButton department={dept} onDeleted={fetchData} /></TableCell>
                                    </TableRow>
                                ))
                                : <TableRow className="border-clay-border"><TableCell colSpan={2} className="h-24 text-center text-[13px] text-clay-ink-muted">No departments created yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </ClayCard>
            </div>
        </div>
    );
}
