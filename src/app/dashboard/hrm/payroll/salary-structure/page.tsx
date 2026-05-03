'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LoaderCircle, Plus, Trash2, Edit, Save, FileText, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSalaryStructures, saveSalaryStructure, deleteSalaryStructure } from '@/app/actions/crm-payroll.actions';
import type { WithId, CrmSalaryStructure } from '@/lib/definitions';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState = { success: false, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton type="submit" variant="obsidian" disabled={pending} leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
            {isEditing ? 'Save Structure' : 'Create Structure'}
        </ClayButton>
    );
}

type ComponentRow = {
    name: string;
    type: 'earning' | 'deduction';
    calculationType: 'fixed' | 'percentage';
    value: number;
    taxable?: boolean;
};

function StructureFormDialog({ isOpen, onOpenChange, onSave, structure }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    structure?: WithId<CrmSalaryStructure> | null;
}) {
    const [state, formAction] = useActionState(saveSalaryStructure, saveInitialState);
    const { toast } = useToast();
    const isEditing = !!structure;
    const [components, setComponents] = useState<ComponentRow[]>(structure?.components ?? []);

    useEffect(() => {
        if (isOpen) setComponents(structure?.components ?? []);
    }, [isOpen, structure]);

    useEffect(() => {
        if (state.success) {
            toast({ title: 'Success', description: 'Salary structure saved.' });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    const updateComponent = (index: number, field: string, value: string | number | boolean) => {
        setComponents(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
    };
    const addComponent = (type: 'earning' | 'deduction') =>
        setComponents(prev => [...prev, { name: '', type, calculationType: 'fixed', value: 0, taxable: false }]);
    const removeComponent = (index: number) =>
        setComponents(prev => prev.filter((_, i) => i !== index));

    const renderComponents = (type: 'earning' | 'deduction') => {
        const filtered = components.map((c, originalIndex) => ({ ...c, originalIndex })).filter(c => c.type === type);
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-foreground capitalize">{type}s</h4>
                    <ClayButton type="button" variant="pill" size="sm" leading={<Plus className="h-3.5 w-3.5" />} onClick={() => addComponent(type)}>
                        Add {type}
                    </ClayButton>
                </div>
                {filtered.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border p-3 text-center text-[12.5px] text-muted-foreground">
                        No {type}s defined yet.
                    </p>
                )}
                {filtered.map(comp => (
                    <div key={comp.originalIndex} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 rounded-lg border border-border bg-secondary p-3">
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-muted-foreground">Component Name</Label>
                            <Input
                                placeholder={type === 'earning' ? 'e.g. Basic Pay' : 'e.g. Prof. Tax'}
                                value={comp.name}
                                onChange={e => updateComponent(comp.originalIndex, 'name', e.target.value)}
                                className="h-9 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-muted-foreground">Calc. Type</Label>
                            <RadioGroup
                                value={comp.calculationType}
                                onValueChange={val => updateComponent(comp.originalIndex, 'calculationType', val)}
                                className="flex h-9 items-center gap-3"
                            >
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-foreground">
                                    <RadioGroupItem value="fixed" /> Fixed
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-foreground">
                                    <RadioGroupItem value="percentage" /> %
                                </label>
                            </RadioGroup>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-muted-foreground">
                                {comp.calculationType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
                            </Label>
                            <Input
                                type="number"
                                value={comp.value}
                                onChange={e => updateComponent(comp.originalIndex, 'value', Number(e.target.value))}
                                className="h-9 w-24 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-muted-foreground">Taxable</Label>
                            <button
                                type="button"
                                onClick={() => updateComponent(comp.originalIndex, 'taxable', !comp.taxable)}
                                className="flex h-9 items-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {comp.taxable
                                    ? <CheckSquare className="h-4 w-4 text-primary" />
                                    : <Square className="h-4 w-4" />
                                }
                            </button>
                        </div>
                        <ClayButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeComponent(comp.originalIndex)}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </ClayButton>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <form action={formAction}>
                    <input type="hidden" name="id" value={structure?._id.toString()} />
                    <input type="hidden" name="components" value={JSON.stringify(components)} />
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit' : 'Create'} Salary Structure</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Structure Name <span className="text-destructive">*</span></Label>
                                <Input name="name" defaultValue={structure?.name} required className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input name="description" defaultValue={structure?.description} className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                            {renderComponents('earning')}
                        </div>
                        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                            {renderComponents('deduction')}
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <ClayButton type="button" variant="pill" onClick={() => onOpenChange(false)}>Cancel</ClayButton>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function SalaryStructurePage() {
    const [structures, setStructures] = useState<WithId<CrmSalaryStructure>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<WithId<CrmSalaryStructure> | null>(null);
    const { toast } = useToast();

    const fetchData = () => {
        startLoading(async () => {
            const data = await getSalaryStructures();
            setStructures(data);
        });
    };

    useEffect(() => { fetchData(); }, []);

    const handleEdit = (structure: WithId<CrmSalaryStructure> | null) => {
        setEditingStructure(structure);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        const result = await deleteSalaryStructure(id);
        if (result.success) {
            toast({ title: 'Success', description: 'Structure deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <>
            <StructureFormDialog
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={fetchData}
                structure={editingStructure}
            />
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Salary Structures"
                    subtitle="Define salary templates with earnings and deductions for different employee roles or grades."
                    icon={FileText}
                    actions={
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" />} onClick={() => handleEdit(null)}>
                            Create New Structure
                        </ClayButton>
                    }
                />
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-foreground">Your Structures</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{structures.length} structure{structures.length !== 1 ? 's' : ''} defined.</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-border bg-secondary">
                                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                                    <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Earnings</th>
                                    <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Deductions</th>
                                    <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Components</th>
                                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </td>
                                    </tr>
                                ) : structures.length > 0 ? (
                                    structures.map(s => {
                                        const earnings = s.components?.filter(c => c.type === 'earning') ?? [];
                                        const deductions = s.components?.filter(c => c.type === 'deduction') ?? [];
                                        return (
                                            <tr key={s._id.toString()} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{s.description ?? '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <ClayBadge tone="green">{earnings.length} earning{earnings.length !== 1 ? 's' : ''}</ClayBadge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <ClayBadge tone="red">{deductions.length} deduction{deductions.length !== 1 ? 's' : ''}</ClayBadge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(s.components ?? []).slice(0, 3).map((c, i) => (
                                                            <ClayBadge key={i} tone="neutral">{c.name}</ClayBadge>
                                                        ))}
                                                        {(s.components?.length ?? 0) > 3 && (
                                                            <ClayBadge tone="neutral">+{(s.components?.length ?? 0) - 3} more</ClayBadge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <ClayButton variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                                                            <Edit className="h-4 w-4" />
                                                        </ClayButton>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <ClayButton variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </ClayButton>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Structure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will delete the &ldquo;{s.name}&rdquo; structure. It won&apos;t affect past payrolls.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(s._id.toString())}>Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="h-24 text-center text-[13px] text-muted-foreground">
                                            No salary structures created yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ClayCard>
            </div>
        </>
    );
}
