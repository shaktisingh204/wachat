'use client';

import { useState, useEffect, useCallback, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Landmark, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmPtSlabs, saveCrmPtSlab, deleteCrmPtSlab, generateProfessionalTaxReport } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
            {isEditing ? 'Save Slab' : 'Add Slab'}
        </Button>
    )
}

function SlabFormDialog({ onSave, slab }: { onSave: () => void, slab?: WithId<CrmProfessionalTaxSlab> | null }) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(saveCrmPtSlab, saveInitialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            setOpen(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {slab ? <Button variant="ghost" size="sm">Edit</Button> : (
                    <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" />}>Add New Slab</ClayButton>
                )}
            </DialogTrigger>
            <DialogContent>
                <form action={formAction}>
                    <input type="hidden" name="slabId" value={slab?._id.toString()} />
                    <DialogHeader>
                        <DialogTitle>{slab ? 'Edit' : 'Add'} Professional Tax Slab</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>State *</Label>
                            <Select name="state" required defaultValue={slab?.state}>
                                <SelectTrigger><SelectValue placeholder="Select a state..." /></SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {indianStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min. Monthly Salary *</Label>
                                <Input type="number" name="minSalary" defaultValue={slab?.minSalary} required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Max. Monthly Salary *</Label>
                                <Input type="number" name="maxSalary" defaultValue={slab?.maxSalary} required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Monthly Tax Amount *</Label>
                            <Input type="number" name="taxAmount" defaultValue={slab?.taxAmount} required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton isEditing={!!slab} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteSlabButton({ slabId, onDeleted }: { slabId: string; onDeleted: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmPtSlab(slabId);
            if (result.success) {
                toast({ title: 'Success', description: 'Slab deleted.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete Slab?</AlertDialogTitle><AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>{isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function ProfessionalTaxPage() {
    const [slabs, setSlabs] = useState<WithId<CrmProfessionalTaxSlab>[]>([]);
    const [report, setReport] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [slabsData, reportData] = await Promise.all([
                getCrmPtSlabs(),
                generateProfessionalTaxReport(),
            ]);
            setSlabs(slabsData);
            setReport(reportData);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Professional Tax"
                subtitle="Manage PT slabs and view calculated tax for your employees."
                icon={Landmark}
            />

            <div className="grid items-start gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ClayCard>
                        <div className="mb-4">
                            <h2 className="text-[16px] font-semibold text-clay-ink">Professional Tax Report</h2>
                            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Calculated PT based on employee salary and defined state slabs.</p>
                        </div>
                        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-clay-border hover:bg-transparent">
                                        <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                        <TableHead className="text-clay-ink-muted">State</TableHead>
                                        <TableHead className="text-clay-ink-muted">Gross Salary</TableHead>
                                        <TableHead className="text-right text-clay-ink-muted">Calculated PT</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? <TableRow className="border-clay-border"><TableCell colSpan={4} className="h-48 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                                    : report.length > 0 ? report.map(item => (
                                        <TableRow key={item.employeeId} className="border-clay-border">
                                            <TableCell className="text-[13px] font-medium text-clay-ink">{item.employeeName}</TableCell>
                                            <TableCell className="text-[13px] text-clay-ink">{item.state}</TableCell>
                                            <TableCell className="text-[13px] text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.grossSalary)}</TableCell>
                                            <TableCell className="text-right text-[13px] font-semibold text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.taxAmount)}</TableCell>
                                        </TableRow>
                                    ))
                                    : <TableRow className="border-clay-border"><TableCell colSpan={4} className="h-24 text-center text-[13px] text-clay-ink-muted">No report data. Add employees with salary and state info.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </ClayCard>
                </div>
                <div className="lg:col-span-1">
                    <ClayCard>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[16px] font-semibold text-clay-ink">Tax Slabs</h2>
                            <SlabFormDialog onSave={fetchData}/>
                        </div>
                        <div className="space-y-2">
                            {slabs.map(slab => (
                                <div key={slab._id.toString()} className="flex items-center justify-between rounded-clay-md border border-clay-border p-2">
                                    <div>
                                        <p className="text-[13px] font-semibold text-clay-ink">{slab.state}</p>
                                        <p className="text-[11.5px] text-clay-ink-muted">₹{slab.minSalary} - ₹{slab.maxSalary} &rarr; ₹{slab.taxAmount}/mo</p>
                                    </div>
                                    <div>
                                        <SlabFormDialog slab={slab} onSave={fetchData} />
                                        <DeleteSlabButton slabId={slab._id.toString()} onDeleted={fetchData} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ClayCard>
                </div>
            </div>
        </div>
    );
}
