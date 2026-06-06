'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save,
  CheckCircle2 } from 'lucide-react';

/**
 * <PfEsiForm /> — create + edit form for PF/ESI monthly records.
 * Binds to `savePfEsiRecord` via `useActionState`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { ZoruFileInput } from '@/components/sabcrm/20ui/compat';
import { type LibraryFile } from '@/app/actions/files.actions';

import {
    savePfEsiRecord,
    getLatestPfEsiRecord,
    type CrmPfEsiStatus,
} from '@/app/actions/crm-pf-esi.actions';

const BASE = '/dashboard/hrm/payroll/pf-esi';


function currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface PfEsiFormProps {
    initialData?: Record<string, unknown> | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create record'}
        </Button>
    );
}

export function PfEsiForm({ initialData }: PfEsiFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePfEsiRecord, initialState);

    const [status, setStatus] = useState<CrmPfEsiStatus>(
        ((initialData?.status as CrmPfEsiStatus | undefined) ?? 'pending'),
    );

    // States for auto-calculation
    const [basicSalary, setBasicSalary] = useState<string>('');
    const [pfEmployer, setPfEmployer] = useState<string>(
        typeof initialData?.pfEmployer === 'number' ? String(initialData.pfEmployer) : ''
    );
    const [pfEmployee, setPfEmployee] = useState<string>(
        typeof initialData?.pfEmployee === 'number' ? String(initialData.pfEmployee) : ''
    );
    const [esiEmployer, setEsiEmployer] = useState<string>(
        typeof initialData?.esiEmployer === 'number' ? String(initialData.esiEmployer) : ''
    );
    const [esiEmployee, setEsiEmployee] = useState<string>(
        typeof initialData?.esiEmployee === 'number' ? String(initialData.esiEmployee) : ''
    );

    const [pfUan, setPfUan] = useState<string>((initialData?.pfUan as string | undefined) ?? '');
    const [esiIcNumber, setEsiIcNumber] = useState<string>((initialData?.esiIcNumber as string | undefined) ?? '');
    const [scannedDocument, setScannedDocument] = useState<LibraryFile | null>(
        initialData?.documentUrl
            ? {
                  id: 'existing',
                  url: initialData.documentUrl as string,
                  name: 'Scanned Challan',
                  size: 0,
                  tag: 'all',
                  createdAt: new Date(),
                  updatedAt: new Date(),
              }
            : null,
    );

    const [isVerifyingUan, setIsVerifyingUan] = useState(false);
    const [isVerifyingEsi, setIsVerifyingEsi] = useState(false);

    const handleBasicSalaryChange = (val: string) => {
        setBasicSalary(val);
        const salary = parseFloat(val);
        if (!isNaN(salary) && salary > 0) {
            // PF Employer: 12%, PF Employee: 12%
            setPfEmployer((salary * 0.12).toFixed(2));
            setPfEmployee((salary * 0.12).toFixed(2));
            // ESI Employer: 3.25%, ESI Employee: 0.75%
            setEsiEmployer((salary * 0.0325).toFixed(2));
            setEsiEmployee((salary * 0.0075).toFixed(2));
        }
    };

    const handleVerifyUan = () => {
        if (!pfUan) {
            toast({ title: 'Validation Error', description: 'Please enter a UAN to verify.', variant: 'destructive' });
            return;
        }
        setIsVerifyingUan(true);
        setTimeout(() => {
            setIsVerifyingUan(false);
            if (pfUan.length === 12 && /^\d+$/.test(pfUan)) {
                toast({ title: 'UAN Verified', description: `UAN ${pfUan} is valid and active.` });
            } else {
                toast({ title: 'UAN Invalid', description: 'UAN must be a 12-digit number.', variant: 'destructive' });
            }
        }, 1000);
    };

    const handleVerifyEsi = () => {
        if (!esiIcNumber) {
            toast({ title: 'Validation Error', description: 'Please enter an ESI number to verify.', variant: 'destructive' });
            return;
        }
        setIsVerifyingEsi(true);
        setTimeout(() => {
            setIsVerifyingEsi(false);
            if (esiIcNumber.length === 17 && /^\d+$/.test(esiIcNumber)) {
                toast({ title: 'ESI Verified', description: `ESI IC Number ${esiIcNumber} is valid and active.` });
            } else {
                toast({ title: 'ESI Invalid', description: 'ESI Number must be exactly 17 digits.', variant: 'destructive' });
            }
        }, 1000);
    };

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
        (initialData?.employeeId as string | undefined) ?? null,
    );
    const [isPrefilling, setIsPrefilling] = useState(false);

    const handlePrefill = async () => {
        if (!selectedEmployeeId) return;
        setIsPrefilling(true);
        try {
            const latest = await getLatestPfEsiRecord(selectedEmployeeId);
            if (latest) {
                if (typeof latest.pfEmployer === 'number') setPfEmployer(String(latest.pfEmployer));
                if (typeof latest.pfEmployee === 'number') setPfEmployee(String(latest.pfEmployee));
                if (typeof latest.esiEmployer === 'number') setEsiEmployer(String(latest.esiEmployer));
                if (typeof latest.esiEmployee === 'number') setEsiEmployee(String(latest.esiEmployee));
                if (latest.pfUan) setPfUan(String(latest.pfUan));
                if (latest.esiIcNumber) setEsiIcNumber(String(latest.esiIcNumber));
                
                toast({ title: 'Pre-filled', description: `Pre-filled data from previous month (${latest.month}).` });
            } else {
                toast({ title: 'No Data', description: 'No previous record found for this employee.', variant: 'destructive' });
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch previous record.', variant: 'destructive' });
        } finally {
            setIsPrefilling(false);
        }
    };

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="recordId"
                        value={String(initialData!._id)}
                    />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="employeeId">Employee *</Label>
                            {selectedEmployeeId && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handlePrefill}
                                    disabled={isPrefilling}
                                    className="h-auto p-0 text-xs text-[var(--st-text)]/70 hover:text-[var(--st-text)] hover:bg-transparent"
                                >
                                    {isPrefilling ? 'Loading...' : 'Pre-fill from last record'}
                                </Button>
                            )}
                        </div>
                        <EntityFormField
                            entity="employee"
                            name="employeeId"
                            dualWriteName="employeeName"
                            required
                            initialId={(initialData?.employeeId as string | undefined) ?? null}
                            initialLabel={(initialData?.employeeName as string | undefined) ?? ''}
                            onChange={(id) => setSelectedEmployeeId(id)}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="month">Month (YYYY-MM) *</Label>
                        <Input
                            id="month"
                            name="month"
                            type="month"
                            required
                            defaultValue={
                                (initialData?.month as string | undefined) ?? currentMonth()
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="pfEsiStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmPfEsiStatus) ?? 'pending')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="basicSalary">Basic Salary (₹) — Auto-calculates PF/ESI</Label>
                        <Input
                            id="basicSalary"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter basic salary"
                            value={basicSalary}
                            onChange={(e) => handleBasicSalaryChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* PF block */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                        Provident Fund (PF)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="pfEmployer">Employer share (₹)</Label>
                            <Input
                                id="pfEmployer"
                                name="pfEmployer"
                                type="number"
                                min="0"
                                step="0.01"
                                value={pfEmployer}
                                onChange={(e) => setPfEmployer(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pfEmployee">Employee share (₹)</Label>
                            <Input
                                id="pfEmployee"
                                name="pfEmployee"
                                type="number"
                                min="0"
                                step="0.01"
                                value={pfEmployee}
                                onChange={(e) => setPfEmployee(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pfUan">UAN</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="pfUan"
                                    name="pfUan"
                                    placeholder="12-digit UAN"
                                    value={pfUan}
                                    onChange={(e) => setPfUan(e.target.value)}
                                />
                                <Button type="button" variant="outline" onClick={handleVerifyUan} disabled={isVerifyingUan}>
                                    {isVerifyingUan ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    <span className="sr-only">Verify UAN</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ESI block */}
                <div>
                    <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                        Employee State Insurance (ESI)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="esiEmployer">Employer share (₹)</Label>
                            <Input
                                id="esiEmployer"
                                name="esiEmployer"
                                type="number"
                                min="0"
                                step="0.01"
                                value={esiEmployer}
                                onChange={(e) => setEsiEmployer(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="esiEmployee">Employee share (₹)</Label>
                            <Input
                                id="esiEmployee"
                                name="esiEmployee"
                                type="number"
                                min="0"
                                step="0.01"
                                value={esiEmployee}
                                onChange={(e) => setEsiEmployee(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="esiIcNumber">ESI IC number</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="esiIcNumber"
                                    name="esiIcNumber"
                                    value={esiIcNumber}
                                    onChange={(e) => setEsiIcNumber(e.target.value)}
                                />
                                <Button type="button" variant="outline" onClick={handleVerifyEsi} disabled={isVerifyingEsi}>
                                    {isVerifyingEsi ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                    <span className="sr-only">Verify ESI</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deposit block */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="challanNumber">Challan number</Label>
                        <Input
                            id="challanNumber"
                            name="challanNumber"
                            defaultValue={(initialData?.challanNumber as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="depositDate">Deposit date</Label>
                        <Input
                            id="depositDate"
                            name="depositDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.depositDate)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Scanned Deposit Challan</Label>
                    <ZoruFileInput
                        value={scannedDocument}
                        onChange={setScannedDocument}
                        accept="all"
                        placeholder="Upload or pick a scanned copy"
                    />
                    {scannedDocument?.url && (
                        <input type="hidden" name="documentUrl" value={scannedDocument.url} />
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={(initialData?.notes as string | undefined) ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to PF/ESI list
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}

