
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { FileText, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmPtSlabs, saveCrmPtSlab, deleteCrmPtSlab, generateProfessionalTaxReport } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';

const saveInitialState = { message: null, error: null };

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
                {slab ? <Button variant="ghost" size="sm">Edit</Button> : <Button><Plus className="mr-2 h-4 w-4" /> Add New Slab</Button>}
            </DialogTrigger>
            <DialogContent>
                <form action={formAction}>
                    <input type="hidden" name="slabId" value={slab?._id.toString()} />
                    <DialogHeader>
                        <DialogTitle>{slab ? 'Edit' : 'Add'} Professional Tax Slab</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
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
                                <Input type="number" name="minSalary" defaultValue={slab?.minSalary} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Max. Monthly Salary *</Label>
                                <Input type="number" name="maxSalary" defaultValue={slab?.maxSalary} required />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Monthly Tax Amount *</Label>
                            <Input type="number" name="taxAmount" defaultValue={slab?.taxAmount} required />
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
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileText className="h-8 w-8" />
                        Professional Tax
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage PT slabs and view calculated tax for your employees.</p>
                </div>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Professional Tax Report</CardTitle>
                             <CardDescription>Calculated PT based on employee salary and defined state slabs.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>State</TableHead>
                                        <TableHead>Gross Salary</TableHead>
                                        <TableHead className="text-right">Calculated PT</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? <TableRow><TableCell colSpan={4} className="h-48 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                    : report.length > 0 ? report.map(item => (
                                        <TableRow key={item.employeeId}>
                                            <TableCell className="font-medium">{item.employeeName}</TableCell>
                                            <TableCell>{item.state}</TableCell>
                                            <TableCell>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.grossSalary)}</TableCell>
                                            <TableCell className="text-right font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.taxAmount)}</TableCell>
                                        </TableRow>
                                    ))
                                    : <TableRow><TableCell colSpan={4} className="h-24 text-center">No report data. Add employees with salary and state info.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                     <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Tax Slabs</CardTitle>
                                <SlabFormDialog onSave={fetchData}/>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {slabs.map(slab => (
                                <div key={slab._id.toString()} className="flex items-center justify-between p-2 border rounded-md">
                                    <div>
                                        <p className="font-semibold text-sm">{slab.state}</p>
                                        <p className="text-xs text-muted-foreground">₹{slab.minSalary} - ₹{slab.maxSalary} &rarr; ₹{slab.taxAmount}/mo</p>
                                    </div>
                                    <div>
                                        <SlabFormDialog slab={slab} onSave={fetchData} />
                                        <DeleteSlabButton slabId={slab._id.toString()} onDeleted={fetchData} />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
