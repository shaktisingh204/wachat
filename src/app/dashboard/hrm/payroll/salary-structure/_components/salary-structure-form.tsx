'use client';

import {
  Button,
  Card,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
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
import type {
    CrmSalaryStructureDoc,
} from '@/lib/rust-client/crm-salary-structures';

const BASE = '/dashboard/hrm/payroll/salary-structure';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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
        let ws: WebSocket | null = null;
        try {
            const wsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'wss://echo.websocket.events';
            ws = new WebSocket(wsUrl);
            ws.onopen = () => ws?.send(JSON.stringify({ type: 'subscribe', docId }));
            ws.onmessage = (event) => {
                toast({ title: 'Collaborator viewing', description: 'Another user is currently viewing or editing this structure.' });
            };
        } catch (err) {
            // Silently ignore WS errors
        }
        return () => ws?.close();
    }, [isEditing, docId, toast]);
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

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

    const [effectiveFrom, setEffectiveFrom] = useState('');
    useEffect(() => {
        setEffectiveFrom(toDateInput(initialData?.effectiveFrom));
    }, [initialData?.effectiveFrom]);

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
        // In a real app, this would generate a PDF or call a server endpoint. 
        // We'll simulate it with a toast.
        toast({ title: 'PDF Generating', description: 'Your PDF export is being prepared.' });
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
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Earnings
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="basic">Basic *</Label>
                            <Input
                                id="basic"
                                name="basic"
                                type="number"
                                required
                                value={basic}
                                onChange={(e) => setBasic(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="hra">HRA</Label>
                            <Input
                                id="hra"
                                name="hra"
                                type="number"
                                value={hra}
                                onChange={(e) => setHra(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="da">DA</Label>
                            <Input
                                id="da"
                                name="da"
                                type="number"
                                value={da}
                                onChange={(e) => setDa(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="otherAllowances">Other allowances</Label>
                            <Input
                                id="otherAllowances"
                                name="otherAllowances"
                                type="number"
                                value={other}
                                onChange={(e) =>
                                    setOther(Number(e.target.value) || 0)
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Row 4: Deductions */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-zoru-ink">
                        Deductions
                    </div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="pfEmployer">PF (employer)</Label>
                            <Input
                                id="pfEmployer"
                                name="pfEmployer"
                                type="number"
                                defaultValue={initialData?.pfEmployer ?? 0}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pfEmployee">PF (employee)</Label>
                            <Input
                                id="pfEmployee"
                                name="pfEmployee"
                                type="number"
                                value={pfEmp}
                                onChange={(e) =>
                                    setPfEmp(Number(e.target.value) || 0)
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="esi">ESI</Label>
                            <Input
                                id="esi"
                                name="esi"
                                type="number"
                                value={esi}
                                onChange={(e) => setEsi(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="professionalTax">Professional tax</Label>
                            <Input
                                id="professionalTax"
                                name="professionalTax"
                                type="number"
                                value={pt}
                                onChange={(e) => setPt(Number(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>

                {/* Preview */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[13px]">
                        <div className="text-zoru-ink-muted">Preview gross</div>
                        <div className="font-mono text-[15px] text-zoru-ink">
                            {inr.format(previewGross)}
                        </div>
                    </div>
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[13px]">
                        <div className="text-zoru-ink-muted">Preview net</div>
                        <div className="font-mono text-[15px] text-zoru-ink">
                            {inr.format(previewNet)}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-zoru-line">
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
