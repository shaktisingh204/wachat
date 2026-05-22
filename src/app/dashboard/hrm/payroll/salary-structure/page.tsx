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
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckSquare,
  Square } from 'lucide-react';
import { getSalaryStructures,
  saveSalaryStructure,
  deleteSalaryStructure } from '@/app/actions/crm-payroll.actions';
import type { WithId,
  CrmSalaryStructure } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const saveInitialState = { success: false, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Structure' : 'Create Structure'}
        </ZoruButton>
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
    const { toast } = useZoruToast();
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
                    <h4 className="text-[13px] text-zoru-ink capitalize">{type}s</h4>
                    <ZoruButton type="button" variant="outline" size="sm" onClick={() => addComponent(type)}>
                        <Plus className="h-3.5 w-3.5" />
                        Add {type}
                    </ZoruButton>
                </div>
                {filtered.length === 0 && (
                    <p className="rounded-lg border border-dashed border-zoru-line p-3 text-center text-[12.5px] text-zoru-ink-muted">
                        No {type}s defined yet.
                    </p>
                )}
                {filtered.map(comp => (
                    <div key={comp.originalIndex} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
                        <div className="space-y-1">
                            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">Component Name</ZoruLabel>
                            <ZoruInput
                                placeholder={type === 'earning' ? 'e.g. Basic Pay' : 'e.g. Prof. Tax'}
                                value={comp.name}
                                onChange={e => updateComponent(comp.originalIndex, 'name', e.target.value)}
                                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">Calc. Type</ZoruLabel>
                            <ZoruRadioGroup
                                value={comp.calculationType}
                                onValueChange={val => updateComponent(comp.originalIndex, 'calculationType', val)}
                                className="flex h-9 items-center gap-3"
                            >
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-zoru-ink">
                                    <ZoruRadioGroupItem value="fixed" /> Fixed
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-zoru-ink">
                                    <ZoruRadioGroupItem value="percentage" /> %
                                </label>
                            </ZoruRadioGroup>
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                                {comp.calculationType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
                            </ZoruLabel>
                            <ZoruInput
                                type="number"
                                value={comp.value}
                                onChange={e => updateComponent(comp.originalIndex, 'value', Number(e.target.value))}
                                className="h-9 w-24 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">Taxable</ZoruLabel>
                            <button
                                type="button"
                                onClick={() => updateComponent(comp.originalIndex, 'taxable', !comp.taxable)}
                                className="flex h-9 items-center text-zoru-ink-muted hover:text-zoru-ink transition-colors"
                            >
                                {comp.taxable
                                    ? <CheckSquare className="h-4 w-4 text-primary" />
                                    : <Square className="h-4 w-4" />
                                }
                            </button>
                        </div>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeComponent(comp.originalIndex)}
                            className="text-zoru-danger-ink hover:text-zoru-danger-ink"
                        >
                            <Trash2 className="h-4 w-4" />
                        </ZoruButton>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-2xl">
                <form action={formAction}>
                    <input type="hidden" name="id" value={structure?._id.toString()} />
                    <input type="hidden" name="components" value={JSON.stringify(components)} />
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>{isEditing ? 'Edit' : 'Create'} Salary Structure</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Structure Name <span className="text-zoru-danger-ink">*</span></ZoruLabel>
                                <ZoruInput name="name" defaultValue={structure?.name} required className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Description</ZoruLabel>
                                <ZoruInput name="description" defaultValue={structure?.description} className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                            </div>
                        </div>
                        <div className="rounded-lg border border-zoru-line bg-zoru-bg p-4 space-y-4">
                            {renderComponents('earning')}
                        </div>
                        <div className="rounded-lg border border-zoru-line bg-zoru-bg p-4 space-y-4">
                            {renderComponents('deduction')}
                        </div>
                    </div>
                    <ZoruDialogFooter className="pt-2">
                        <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

export default function SalaryStructurePage() {
    const [structures, setStructures] = useState<WithId<CrmSalaryStructure>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<WithId<CrmSalaryStructure> | null>(null);
    const { toast } = useZoruToast();

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
            <EntityListShell
                title="Salary Structures"
                subtitle="Define salary templates with earnings and deductions for different employee roles or grades."
                primaryAction={
                    <ZoruButton onClick={() => handleEdit(null)}>
                        <Plus className="h-4 w-4" />
                        Create New Structure
                    </ZoruButton>
                }
            >
                <ZoruCard className="p-6">
                    <div className="mb-4">
                        <h2 className="text-[16px] text-zoru-ink">Your Structures</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{structures.length} structure{structures.length !== 1 ? 's' : ''} defined.</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <table className="w-full text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                    <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Name</th>
                                    <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Description</th>
                                    <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">Earnings</th>
                                    <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">Deductions</th>
                                    <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Components</th>
                                    <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </td>
                                    </tr>
                                ) : structures.length > 0 ? (
                                    structures.map(s => {
                                        const earnings = s.components?.filter(c => c.type === 'earning') ?? [];
                                        const deductions = s.components?.filter(c => c.type === 'deduction') ?? [];
                                        return (
                                            <tr key={s._id.toString()} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-zoru-ink">{s.name}</td>
                                                <td className="px-4 py-3 text-zoru-ink-muted">{s.description ?? '—'}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruBadge variant="success">{earnings.length} earning{earnings.length !== 1 ? 's' : ''}</ZoruBadge>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruBadge variant="danger">{deductions.length} deduction{deductions.length !== 1 ? 's' : ''}</ZoruBadge>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(s.components ?? []).slice(0, 3).map((c, i) => (
                                                            <ZoruBadge key={i} variant="secondary">{c.name}</ZoruBadge>
                                                        ))}
                                                        {(s.components?.length ?? 0) > 3 && (
                                                            <ZoruBadge variant="secondary">+{(s.components?.length ?? 0) - 3} more</ZoruBadge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <ZoruButton variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                                                            <Edit className="h-4 w-4" />
                                                        </ZoruButton>
                                                        <ZoruAlertDialog>
                                                            <ZoruAlertDialogTrigger asChild>
                                                                <ZoruButton variant="ghost" size="icon" className="text-zoru-danger-ink hover:text-zoru-danger-ink">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </ZoruButton>
                                                            </ZoruAlertDialogTrigger>
                                                            <ZoruAlertDialogContent>
                                                                <ZoruAlertDialogHeader>
                                                                    <ZoruAlertDialogTitle>Delete Structure?</ZoruAlertDialogTitle>
                                                                    <ZoruAlertDialogDescription>
                                                                        This will delete the &ldquo;{s.name}&rdquo; structure. It won&apos;t affect past payrolls.
                                                                    </ZoruAlertDialogDescription>
                                                                </ZoruAlertDialogHeader>
                                                                <ZoruAlertDialogFooter>
                                                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                                    <ZoruAlertDialogAction onClick={() => handleDelete(s._id.toString())}>Delete</ZoruAlertDialogAction>
                                                                </ZoruAlertDialogFooter>
                                                            </ZoruAlertDialogContent>
                                                        </ZoruAlertDialog>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                            No salary structures created yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ZoruCard>
            </EntityListShell>
        </>
    );
}
