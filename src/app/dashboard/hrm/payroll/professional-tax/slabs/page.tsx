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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useActionState,
} from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Save, Trash2, Edit, Download } from 'lucide-react';

import { getCrmPtSlabs, saveCrmPtSlab, deleteCrmPtSlab, importCrmPtSlabsTemplate } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PtNavigation } from '../_components/pt-navigation';

const ptTemplates = [
  {
    state: 'Maharashtra',
    slabs: [
      { minSalary: 0, maxSalary: 7500, taxAmount: 0 },
      { minSalary: 7501, maxSalary: 10000, taxAmount: 175 },
      { minSalary: 10001, maxSalary: 9999999, taxAmount: 200 }
    ]
  },
  {
    state: 'Karnataka',
    slabs: [
      { minSalary: 0, maxSalary: 14999, taxAmount: 0 },
      { minSalary: 15000, maxSalary: 9999999, taxAmount: 200 }
    ]
  },
  {
    state: 'Telangana',
    slabs: [
      { minSalary: 0, maxSalary: 15000, taxAmount: 0 },
      { minSalary: 15001, maxSalary: 20000, taxAmount: 150 },
      { minSalary: 20001, maxSalary: 9999999, taxAmount: 200 }
    ]
  },
  {
    state: 'Tamil Nadu',
    slabs: [
      { minSalary: 0, maxSalary: 3500, taxAmount: 0 },
      { minSalary: 3501, maxSalary: 5000, taxAmount: 23 },
      { minSalary: 5001, maxSalary: 7500, taxAmount: 53 },
      { minSalary: 7501, maxSalary: 10000, taxAmount: 115 },
      { minSalary: 10001, maxSalary: 12500, taxAmount: 171 },
      { minSalary: 12501, maxSalary: 9999999, taxAmount: 208 }
    ]
  }
];

function ImportTemplatesDropdown({ onImported }: { onImported: () => void }) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const handleImport = (state: string, slabsData: Array<{minSalary: number, maxSalary: number, taxAmount: number}>) => {
        startTransition(async () => {
            const result = await importCrmPtSlabsTemplate(state, slabsData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
                onImported();
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={isPending}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Import Templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ptTemplates.map((t) => (
                    <DropdownMenuItem 
                        key={t.state}
                        onClick={() => handleImport(t.state, t.slabs)}
                    >
                        {t.state}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const saveInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Slab' : 'Add Slab'}
        </Button>
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
            state.message = null; // Reset
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
            state.error = null; // Reset
        }
    }, [state, toast, onSave]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                {slab ? (
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                ) : (
                    <Button><Plus className="h-4 w-4" />Add New Slab</Button>
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
                            <Label>State <span className="text-zoru-danger-ink">*</span></Label>
                            <Select name="state" required defaultValue={slab?.state}>
                                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                                    <ZoruSelectValue placeholder="Select a state..." />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent className="max-h-60">
                                    {indianStates.map(s => <ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>)}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Min. Monthly Salary (₹) <span className="text-zoru-danger-ink">*</span></Label>
                                <Input type="number" name="minSalary" defaultValue={slab?.minSalary} required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Max. Monthly Salary (₹) <span className="text-zoru-danger-ink">*</span></Label>
                                <Input type="number" name="maxSalary" defaultValue={slab?.maxSalary} required
                                    className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Monthly Tax Amount (₹) <span className="text-zoru-danger-ink">*</span></Label>
                            <Input type="number" name="taxAmount" defaultValue={slab?.taxAmount} required
                                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton isEditing={!!slab} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
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
                <Button variant="ghost" size="icon" className="text-zoru-danger-ink hover:text-zoru-danger-ink">
                    <Trash2 className="h-4 w-4" />
                </Button>
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

export default function ProfessionalTaxSlabsPage() {
    const [slabs, setSlabs] = useState<WithId<CrmProfessionalTaxSlab>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const slabsData = await getCrmPtSlabs();
            setSlabs(slabsData);
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <EntityListShell
            title="Professional Tax Slabs"
            subtitle="Configure state-wise PT slabs."
            viewSwitcher={<PtNavigation />}
        >
            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">Tax Slabs Configuration</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">State-wise salary bands</p>
                    </div>
                    <div className="flex gap-2">
                        <ImportTemplatesDropdown onImported={fetchData} />
                        <SlabFormDialog onSave={fetchData} />
                    </div>
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
                                        <Badge variant="secondary">{slab.state}</Badge>
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
                        No slabs configured. Click &ldquo;Add New Slab&rdquo; to start or import templates.
                    </div>
                )}
            </Card>
        </EntityListShell>
    );
}
