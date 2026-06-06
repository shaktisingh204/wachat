'use client';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, RadioGroup, RadioGroupItem, useToast } from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect,
  useActionState,
} from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Trash2, Save, CheckSquare, Square } from 'lucide-react';
import { saveSalaryStructure } from '@/app/actions/crm-payroll.actions';
import type { WithId, CrmSalaryStructure } from '@/lib/definitions';

const saveInitialState = { success: false, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Structure' : 'Create Structure'}
        </Button>
    );
}

type ComponentRow = {
    name: string;
    type: 'earning' | 'deduction';
    calculationType: 'fixed' | 'percentage';
    value: number;
    taxable?: boolean;
};

type ComponentRowWithId = ComponentRow & { _uiId: string };

export function StructureFormDialog({ isOpen, onOpenChange, onSave, structure }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    structure?: WithId<CrmSalaryStructure> | null;
}) {
    const [state, formAction] = useActionState(saveSalaryStructure, saveInitialState);
    const { toast } = useToast();
    const isEditing = !!structure;
    
    const [components, setComponents] = useState<ComponentRowWithId[]>([]);

    useEffect(() => {
        if (isOpen) {
            setComponents((structure?.components ?? []).map(c => ({ ...c, _uiId: crypto.randomUUID() })));
        }
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

    const updateComponent = (id: string, field: string, value: string | number | boolean) => {
        setComponents(prev => prev.map(c => c._uiId === id ? { ...c, [field]: value } : c));
    };
    const addComponent = (type: 'earning' | 'deduction') =>
        setComponents(prev => [...prev, { _uiId: crypto.randomUUID(), name: '', type, calculationType: 'fixed', value: 0, taxable: false }]);
    const removeComponent = (id: string) =>
        setComponents(prev => prev.filter(c => c._uiId !== id));

    const renderComponents = (type: 'earning' | 'deduction') => {
        const filtered = components.filter(c => c.type === type);
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-medium text-[var(--st-text)] capitalize">{type}s</h4>
                    <Button type="button" variant="outline" size="sm" onClick={() => addComponent(type)}>
                        <Plus className="h-3.5 w-3.5" />
                        Add {type}
                    </Button>
                </div>
                {filtered.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[var(--st-border)] p-3 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                        No {type}s defined yet.
                    </p>
                )}
                {filtered.map(comp => (
                    <div key={comp._uiId} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">Component Name</Label>
                            <Input
                                placeholder={type === 'earning' ? 'e.g. Basic Pay' : 'e.g. Prof. Tax'}
                                value={comp.name}
                                onChange={e => updateComponent(comp._uiId, 'name', e.target.value)}
                                className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">Calc. Type</Label>
                            <RadioGroup
                                value={comp.calculationType}
                                onValueChange={val => updateComponent(comp._uiId, 'calculationType', val)}
                                className="flex h-9 items-center gap-3"
                            >
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-[var(--st-text)]">
                                    <RadioGroupItem value="fixed" /> Fixed
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer text-[12.5px] text-[var(--st-text)]">
                                    <RadioGroupItem value="percentage" /> %
                                </label>
                            </RadioGroup>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">
                                {comp.calculationType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
                            </Label>
                            <Input
                                type="number"
                                value={comp.value}
                                onChange={e => updateComponent(comp._uiId, 'value', Number(e.target.value))}
                                className="h-9 w-24 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11.5px] text-[var(--st-text-secondary)]">Taxable</Label>
                            <button
                                type="button"
                                onClick={() => updateComponent(comp._uiId, 'taxable', !comp.taxable)}
                                className="flex h-9 items-center text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
                            >
                                {comp.taxable
                                    ? <CheckSquare className="h-4 w-4 text-[var(--st-text)]" />
                                    : <Square className="h-4 w-4" />
                                }
                            </button>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeComponent(comp._uiId)}
                            className="text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-[var(--st-bg)] border-[var(--st-border)]">
                <form action={formAction}>
                    {isEditing && <input type="hidden" name="id" value={structure?._id.toString()} />}
                    <input type="hidden" name="components" value={JSON.stringify(components)} />
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit' : 'Create'} Salary Structure</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Structure Name <span className="text-[var(--st-danger)]">*</span></Label>
                                <Input name="name" defaultValue={structure?.name} required className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input name="description" defaultValue={structure?.description} className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]" />
                            </div>
                        </div>
                        <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 space-y-4">
                            {renderComponents('earning')}
                        </div>
                        <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 space-y-4">
                            {renderComponents('deduction')}
                        </div>
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
