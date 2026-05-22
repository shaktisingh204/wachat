'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Plus,
  Save,
  Trash2,
  Edit } from 'lucide-react';

import { getCrmPtSlabs, saveCrmPtSlab, deleteCrmPtSlab, generateProfessionalTaxReport } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const saveInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Slab' : 'Add Slab'}
        </ZoruButton>
    );
}

function SlabFormDialog({ onSave, slab }: { onSave: () => void; slab?: WithId<CrmProfessionalTaxSlab> | null }) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(saveCrmPtSlab, saveInitialState);
    const { toast } = useZoruToast();

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
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                {slab ? (
                    <ZoruButton variant="ghost" size="icon"><Edit className="h-4 w-4" /></ZoruButton>
                ) : (
                    <ZoruButton><Plus className="h-4 w-4" />Add New Slab</ZoruButton>
                )}
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <form action={formAction}>
                    <input type="hidden" name="slabId" value={slab?._id.toString()} />
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>{slab ? 'Edit' : 'Add'} Professional Tax Slab</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <ZoruLabel>State <span className="text-zoru-danger-ink">*</span></ZoruLabel>
                            <ZoruSelect name="state" required defaultValue={slab?.state}>
                                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                    <ZoruSelectValue placeholder="Select a state..." />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent className="max-h-60">
                                    {indianStates.map(s => <ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>)}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Min. Monthly Salary (₹) <span className="text-zoru-danger-ink">*</span></ZoruLabel>
                                <ZoruInput type="number" name="minSalary" defaultValue={slab?.minSalary} required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Max. Monthly Salary (₹) <span className="text-zoru-danger-ink">*</span></ZoruLabel>
                                <ZoruInput type="number" name="maxSalary" defaultValue={slab?.maxSalary} required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Monthly Tax Amount (₹) <span className="text-zoru-danger-ink">*</span></ZoruLabel>
                            <ZoruInput type="number" name="taxAmount" defaultValue={slab?.taxAmount} required
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <SubmitButton isEditing={!!slab} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function DeleteSlabButton({ slabId, onDeleted }: { slabId: string; onDeleted: () => void }) {
    const { toast } = useZoruToast();
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
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <ZoruButton variant="ghost" size="icon" className="text-zoru-danger-ink hover:text-zoru-danger-ink">
                    <Trash2 className="h-4 w-4" />
                </ZoruButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Delete Slab?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>Are you sure? This cannot be undone.</ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Delete
                    </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
        </ZoruAlertDialog>
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
        <EntityListShell
            title="Professional Tax"
            subtitle="Manage state-wise PT slabs and view calculated tax for employees."
        >

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total PT Liability</p>
                    <div className="mt-2 text-2xl text-zoru-ink">₹{totalPT.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">Current month across all employees</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">States Configured</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{statesCount}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{slabs.length} total slabs defined</p>
                </ZoruCard>
                <ZoruCard className="p-6">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Employees Applicable</p>
                    <div className="mt-2 text-2xl text-zoru-ink">{report.length}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">with matching state slab</p>
                </ZoruCard>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-3">
                {/* PT Report table — 2 columns wide */}
                <div className="lg:col-span-2">
                    <ZoruCard className="p-6">
                        <div className="mb-4">
                            <h2 className="text-[16px] text-zoru-ink">Professional Tax Report</h2>
                            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                Calculated PT based on employee salary and defined state slabs.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-zoru-line">
                            <table className="w-full text-left text-[13px]">
                                <thead>
                                    <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                        <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Employee</th>
                                        <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">State</th>
                                        <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Gross Salary</th>
                                        <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Applicable Slab</th>
                                        <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Calculated PT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="h-48 text-center">
                                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                            </td>
                                        </tr>
                                    ) : report.length > 0 ? (
                                        report.map((item, idx) => (
                                            <tr key={item.employeeId ?? idx} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-zoru-ink">{item.employeeName}</div>
                                                    <div className="text-[11.5px] text-zoru-ink-muted">{item.designation ?? '—'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ZoruBadge variant="secondary">{item.state}</ZoruBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.grossSalary)}
                                                </td>
                                                <td className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                                                    ₹{item.slabMin?.toLocaleString('en-IN') ?? '—'} – ₹{item.slabMax?.toLocaleString('en-IN') ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.taxAmount)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                                No data. Add employees with salary and state info, then define slabs.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {report.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                                            <td colSpan={4} className="px-4 py-3 text-[12.5px] text-zoru-ink">Total PT</td>
                                            <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPT)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </ZoruCard>
                </div>

                {/* Slabs panel */}
                <div className="lg:col-span-1">
                    <ZoruCard className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-[16px] text-zoru-ink">Tax Slabs</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">State-wise salary bands</p>
                            </div>
                            <SlabFormDialog onSave={fetchData} />
                        </div>

                        {isLoading ? (
                            <div className="flex h-24 items-center justify-center">
                                <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
                            </div>
                        ) : slabs.length > 0 ? (
                            <div className="space-y-2">
                                {slabs.map(slab => (
                                    <div key={slab._id.toString()} className="flex items-start justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <ZoruBadge variant="secondary">{slab.state}</ZoruBadge>
                                            </div>
                                            <p className="mt-1.5 text-[12px] text-zoru-ink-muted">
                                                ₹{slab.minSalary.toLocaleString('en-IN')} – ₹{slab.maxSalary.toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[13px] text-zoru-ink">
                                                ₹{slab.taxAmount.toLocaleString('en-IN')}<span className="text-[11.5px] font-normal text-zoru-ink-muted">/month</span>
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
                            <div className="rounded-lg border border-dashed border-zoru-line p-6 text-center text-[12.5px] text-zoru-ink-muted">
                                No slabs configured. Click &ldquo;Add New Slab&rdquo; to start.
                            </div>
                        )}
                    </ZoruCard>
                </div>
            </div>
        </EntityListShell>
    );
}
