'use client';

import { useState, useEffect, useCallback, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Landmark, LoaderCircle, Plus, Save, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmPtSlabs, saveCrmPtSlab, deleteCrmPtSlab, generateProfessionalTaxReport } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton type="submit" variant="obsidian" disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
            {isEditing ? 'Save Slab' : 'Add Slab'}
        </ClayButton>
    );
}

function SlabFormDialog({ onSave, slab }: { onSave: () => void; slab?: WithId<CrmProfessionalTaxSlab> | null }) {
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
                {slab ? (
                    <ClayButton variant="ghost" size="icon"><Edit className="h-4 w-4" /></ClayButton>
                ) : (
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
                            <Label>State <span className="text-destructive">*</span></Label>
                            <Select name="state" required defaultValue={slab?.state}>
                                <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]">
                                    <SelectValue placeholder="Select a state..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {indianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min. Monthly Salary (₹) <span className="text-destructive">*</span></Label>
                                <Input type="number" name="minSalary" defaultValue={slab?.minSalary} required
                                    className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Max. Monthly Salary (₹) <span className="text-destructive">*</span></Label>
                                <Input type="number" name="maxSalary" defaultValue={slab?.maxSalary} required
                                    className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Monthly Tax Amount (₹) <span className="text-destructive">*</span></Label>
                            <Input type="number" name="taxAmount" defaultValue={slab?.taxAmount} required
                                className="h-10 rounded-lg border-border bg-card text-[13px]" />
                        </div>
                    </div>
                    <DialogFooter>
                        <ClayButton type="button" variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
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
            <AlertDialogTrigger asChild>
                <ClayButton variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                </ClayButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Slab?</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Delete
                    </AlertDialogAction>
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

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalPT = report.reduce((s, r) => s + (r.taxAmount ?? 0), 0);
    const statesCount = [...new Set(slabs.map(s => s.state))].length;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Professional Tax"
                subtitle="Manage state-wise PT slabs and view calculated tax for employees."
                icon={Landmark}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Total PT Liability</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">₹{totalPT.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Current month across all employees</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">States Configured</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">{statesCount}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">{slabs.length} total slabs defined</p>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Employees Applicable</p>
                    <div className="mt-2 text-2xl font-bold text-foreground">{report.length}</div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">with matching state slab</p>
                </ClayCard>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-3">
                {/* PT Report table — 2 columns wide */}
                <div className="lg:col-span-2">
                    <ClayCard>
                        <div className="mb-4">
                            <h2 className="text-[16px] font-semibold text-foreground">Professional Tax Report</h2>
                            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                Calculated PT based on employee salary and defined state slabs.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-[13px]">
                                <thead>
                                    <tr className="border-b border-border bg-secondary">
                                        <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Employee</th>
                                        <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">State</th>
                                        <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Gross Salary</th>
                                        <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Applicable Slab</th>
                                        <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Calculated PT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="h-48 text-center">
                                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </td>
                                        </tr>
                                    ) : report.length > 0 ? (
                                        report.map((item, idx) => (
                                            <tr key={item.employeeId ?? idx} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">{item.employeeName}</div>
                                                    <div className="text-[11.5px] text-muted-foreground">{item.designation ?? '—'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ClayBadge tone="neutral">{item.state}</ClayBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.grossSalary)}
                                                </td>
                                                <td className="px-4 py-3 text-[12px] text-muted-foreground">
                                                    ₹{item.slabMin?.toLocaleString('en-IN') ?? '—'} – ₹{item.slabMax?.toLocaleString('en-IN') ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.taxAmount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                                No data. Add employees with salary and state info, then define slabs.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {report.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-border bg-secondary">
                                            <td colSpan={4} className="px-4 py-3 text-[12.5px] font-semibold text-foreground">Total PT</td>
                                            <td className="px-4 py-3 text-right font-mono text-[12.5px] font-bold text-foreground">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPT)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </ClayCard>
                </div>

                {/* Slabs panel */}
                <div className="lg:col-span-1">
                    <ClayCard>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-[16px] font-semibold text-foreground">Tax Slabs</h2>
                                <p className="mt-0.5 text-[12.5px] text-muted-foreground">State-wise salary bands</p>
                            </div>
                            <SlabFormDialog onSave={fetchData} />
                        </div>

                        {isLoading ? (
                            <div className="flex h-24 items-center justify-center">
                                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : slabs.length > 0 ? (
                            <div className="space-y-2">
                                {slabs.map(slab => (
                                    <div key={slab._id.toString()} className="flex items-start justify-between rounded-lg border border-border bg-secondary p-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <ClayBadge tone="neutral">{slab.state}</ClayBadge>
                                            </div>
                                            <p className="mt-1.5 text-[12px] text-muted-foreground">
                                                ₹{slab.minSalary.toLocaleString('en-IN')} – ₹{slab.maxSalary.toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[13px] font-semibold text-foreground">
                                                ₹{slab.taxAmount.toLocaleString('en-IN')}<span className="text-[11.5px] font-normal text-muted-foreground">/month</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            <SlabFormDialog slab={slab} onSave={fetchData} />
                                            <DeleteSlabButton slabId={slab._id.toString()} onDeleted={fetchData} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-border p-6 text-center text-[12.5px] text-muted-foreground">
                                No slabs configured. Click &ldquo;Add New Slab&rdquo; to start.
                            </div>
                        )}
                    </ClayCard>
                </div>
            </div>
        </div>
    );
}
