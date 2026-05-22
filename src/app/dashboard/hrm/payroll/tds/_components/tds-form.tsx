'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

// 1E.sweep: quarter/status converted to <EnumFormField> using
// `tdsQuarter` / `tdsStatus`. TODOs remaining:
// - financial-year is a dynamically-generated list (fyOptions(6)) — leave
//   as Select until an <EnumFieldYearRange> variant exists.
// - employee → <EntityFormField entity="employee">.

/**
 * <TdsForm /> — create + edit form for TDS records.
 * Binds to `saveTdsRecord` via `useActionState`.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveTdsRecord,
    type CrmTdsQuarter,
    type CrmTdsStatus,
} from '@/app/actions/crm-tds.actions';

const BASE = '/dashboard/hrm/payroll/tds';

function currentFY(): string {
    const now = new Date();
    const sy = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    return `${sy}-${String(sy + 1).slice(-2)}`;
}

function fyOptions(count = 6): string[] {
    const baseYear = (() => {
        const now = new Date();
        return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    })();
    return Array.from({ length: count }, (_, i) => {
        const sy = baseYear - i;
        return `${sy}-${String(sy + 1).slice(-2)}`;
    });
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface TdsFormProps {
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
            {isEditing ? 'Save changes' : 'Create TDS record'}
        </Button>
    );
}

export function TdsForm({ initialData }: TdsFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTdsRecord, initialState);

    const [financialYear, setFinancialYear] = useState<string>(
        (initialData?.financialYear as string | undefined) ?? currentFY(),
    );
    const [quarter, setQuarter] = useState<CrmTdsQuarter>(
        ((initialData?.quarter as CrmTdsQuarter | undefined) ?? 'Q1'),
    );
    const [status, setStatus] = useState<CrmTdsStatus>(
        ((initialData?.status as CrmTdsStatus | undefined) ?? 'pending'),
    );

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
                <input type="hidden" name="financialYear" value={financialYear} />
                <input type="hidden" name="quarter" value={quarter} />
                <input type="hidden" name="status" value={status} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeName">Employee name *</Label>
                        <Input
                            id="employeeName"
                            name="employeeName"
                            required
                            defaultValue={(initialData?.employeeName as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                            id="employeeId"
                            name="employeeId"
                            defaultValue={(initialData?.employeeId as string | undefined) ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="fy-trigger">Financial year</Label>
                        {/* TODO 1E.sweep: dynamic list — needs <EnumFieldYearRange> variant (rolling 6-FY window) */}
                        <Select value={financialYear} onValueChange={setFinancialYear}>
                            <ZoruSelectTrigger id="fy-trigger">
                                <ZoruSelectValue placeholder="FY" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {fyOptions(6).map((fy) => (
                                    <ZoruSelectItem key={fy} value={fy}>
                                        FY {fy}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Quarter</Label>
                        <EnumFormField
                            name="quarter-picker"
                            enumName="tdsQuarter"
                            initialId={quarter}
                            onChange={(id) => setQuarter((id as CrmTdsQuarter) ?? 'Q1')}
                            allowInlineCreate={false}
                            placeholder="Quarter"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="tdsStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmTdsStatus) ?? 'pending')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="grossAmount">Gross amount (₹)</Label>
                        <Input
                            id="grossAmount"
                            name="grossAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                typeof initialData?.grossAmount === 'number'
                                    ? String(initialData.grossAmount)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="tdsAmount">TDS amount (₹)</Label>
                        <Input
                            id="tdsAmount"
                            name="tdsAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                typeof initialData?.tdsAmount === 'number'
                                    ? String(initialData.tdsAmount)
                                    : ''
                            }
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="certificateNumber">Certificate number</Label>
                        <Input
                            id="certificateNumber"
                            name="certificateNumber"
                            placeholder="e.g. TDS-2025-Q1-001"
                            defaultValue={(initialData?.certificateNumber as string | undefined) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="depositChallanNumber">Deposit challan number</Label>
                        <Input
                            id="depositChallanNumber"
                            name="depositChallanNumber"
                            placeholder="Challan #"
                            defaultValue={(initialData?.depositChallanNumber as string | undefined) ?? ''}
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes…"
                        defaultValue={(initialData?.notes as string | undefined) ?? ''}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to TDS list
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
