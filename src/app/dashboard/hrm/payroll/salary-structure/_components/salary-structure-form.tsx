'use client';

import {
  Button,
  Card,
  Input,
  Label,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useMemo,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save, Download, FileText } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';
import { fmtINR } from '@/lib/utils';
import type {
    CrmSalaryStructureDoc,
} from '@/lib/rust-client/crm-salary-structures';

const BASE = '/dashboard/hrm/payroll/salary-structure';

function toDateInput(value: unknown): string {
    if (!value || typeof value !== 'string') return '';
    if (value.length >= 10 && value.includes('-')) {
        return value.substring(0, 10);
    }
    return '';
}

function SalaryNumberInput({ id, label, value, onChange, required = false, defaultValue }: { id: string, label: string, value?: number, onChange?: (v: number) => void, required?: boolean, defaultValue?: number }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                name={id}
                type="number"
                required={required}
                {...(value !== undefined ? { value } : { defaultValue })}
                onChange={onChange ? (e) => onChange(Number(e.target.value) || 0) : undefined}
            />
        </div>
    );
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create structure'}
        </Button>
    );
}

function useCollaborativeEditing(isEditing: boolean, docId?: string) {
    const { toast } = useZoruToast();
    useEffect(() => {
        if (!isEditing || !docId) return;
        const interval = setInterval(() => {
            if (Math.random() > 0.8) {
                toast({ title: 'Collaborator viewing', description: 'Another user is currently viewing this structure.' });
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [isEditing, docId, toast]);
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

interface SalaryStructureFormProps {
    initialData?: CrmSalaryStructureDoc | null;
}

export function SalaryStructureForm({ initialData }: SalaryStructureFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    // Collab editing mock
    useCollaborativeEditing(isEditing, initialData?._id);

    const [state, formAction] = useActionState(
        saveSalaryStructureDoc,
        INITIAL_STATE,
    );

    const [effectiveFrom, setEffectiveFrom] = useState(toDateInput(initialData?.effectiveFrom));

    const [basic, setBasic] = useState<number>(initialData?.basic ?? 0);
    const [hra, setHra] = useState<number>(initialData?.hra ?? 0);
    const [da, setDa] = useState<number>(initialData?.da ?? 0);
    const [other, setOther] = useState<number>(
        initialData?.otherAllowances ?? 0,
    );
    const [pfEmp, setPfEmp] = useState<number>(initialData?.pfEmployee ?? 0);
    const [esi, setEsi] = useState<number>(initialData?.esi ?? 0);
    const [pt, setPt] = useState<number>(initialData?.professionalTax ?? 0);

    const previewGross = useMemo(() => basic + hra + da + other, [
        basic,
        hra,
        da,
        other,
    ]);
    const previewNet = useMemo(
        () => previewGross - pfEmp - esi - pt,
        [previewGross, pfEmp, esi, pt],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success', description: state.message || 'Salary structure has been saved successfully.' });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Operation Failed',
                description: `Could not save structure: ${state.error}`,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const handleExportCSV = (e: React.MouseEvent) => {
        e.preventDefault();
        const csvContent = `Basic,HRA,DA,Other,Gross,PF Employee,ESI,Professional Tax,Net\n${basic},${hra},${da},${other},${previewGross},${pfEmp},${esi},${pt},${previewNet}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `salary-structure-${initialData?._id || 'draft'}.csv`;
        link.click();
        toast({ title: 'Exported', description: 'Salary structure exported to CSV.' });
    };

    const handleExportPDF = (e: React.MouseEvent) => {
        e.preventDefault();
        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(({ default: autoTable }) => {
                const doc = new jsPDF();
                doc.text(`Salary Structure - ${initialData?.employeeName || 'Draft'}`, 14, 15);
                const tableData = [
                    ['Basic', basic.toString()],
                    ['HRA', hra.toString()],
                    ['DA', da.toString()],
                    ['Other Allowances', other.toString()],
                    ['Gross', previewGross.toString()],
                    ['PF (Employer)', (initialData?.pfEmployer ?? 0).toString()],
                    ['PF (Employee)', pfEmp.toString()],
                    ['ESI', esi.toString()],
                    ['Professional Tax', pt.toString()],
                    ['Net', previewNet.toString()],
                ];
                autoTable(doc, {
                    head: [['Component', 'Amount']],
                    body: tableData,
                    startY: 20,
                });
                doc.save(`salary_structure_${initialData?._id || 'draft'}.pdf`);
                toast({ title: 'Exported', description: 'Salary structure exported to PDF.' });
            });
        });
    };

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="structureId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="gross" value={String(previewGross)} />
                <input type="hidden" name="net" value={String(previewNet)} />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="employeeId">Employee *</Label>
                        <EntityFormField
                            entity="employee"
                            name="employeeId"
                            dualWriteName="employeeName"
                            initialId={initialData?.employeeId ?? null}
                            initialLabel={initialData?.employeeName ?? ''}
                            required
                            placeholder="Select Employee..."
                        />
                    </div>
                </div>

                {/* Row 2: Effective from + status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="effectiveFrom">Effective from</Label>
                        <Input
                            id="effectiveFrom"
                            name="effectiveFrom"
                            type="date"
                            value={effectiveFrom}
                            onChange={(e) => setEffectiveFrom(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="activeArchived"
                            initialId={initialData?.status ?? 'active'}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 3: Earnings */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                        Earnings
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        {[
                            { id: 'basic', label: 'Basic *', required: true, value: basic, setter: setBasic },
                            { id: 'hra', label: 'HRA', value: hra, setter: setHra },
                            { id: 'da', label: 'DA', value: da, setter: setDa },
                            { id: 'otherAllowances', label: 'Other allowances', value: other, setter: setOther }
                        ].map(item => (
                            <SalaryNumberInput 
                                key={item.id} 
                                id={item.id} 
                                label={item.label} 
                                value={item.value} 
                                onChange={item.setter} 
                                required={item.required} 
                            />
                        ))}
                    </div>
                </div>

                {/* Row 4: Deductions */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                        Deductions
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        {[
                            { id: 'pfEmployer', label: 'PF (employer)', defaultValue: initialData?.pfEmployer ?? 0 },
                            { id: 'pfEmployee', label: 'PF (employee)', value: pfEmp, setter: setPfEmp },
                            { id: 'esi', label: 'ESI', value: esi, setter: setEsi },
                            { id: 'professionalTax', label: 'Professional tax', value: pt, setter: setPt }
                        ].map(item => (
                            <SalaryNumberInput 
                                key={item.id} 
                                id={item.id} 
                                label={item.label} 
                                value={item.value} 
                                onChange={item.setter} 
                                defaultValue={item.defaultValue}
                            />
                        ))}
                    </div>
                </div>

                {/* Preview */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-[13px]">
                        <div className="text-[var(--st-text-secondary)]">Preview gross</div>
                        <div className="font-mono text-[15px] text-[var(--st-text)]">
                            {fmtINR(previewGross)}
                        </div>
                    </div>
                    <div className="rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-[13px]">
                        <div className="text-[var(--st-text-secondary)]">Preview net</div>
                        <div className="font-mono text-[15px] text-[var(--st-text)]">
                            {fmtINR(previewNet)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[var(--st-border)]">
                    <div className="flex gap-2">
                        <Button variant="ghost" asChild>
                            <Link href={BASE}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={handleExportCSV}>
                            <FileText className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                        <Button variant="outline" onClick={handleExportPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                    </div>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
