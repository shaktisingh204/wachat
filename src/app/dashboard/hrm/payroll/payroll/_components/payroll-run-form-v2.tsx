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
  useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <PayrollRunForm /> — create + edit form for the canonical payroll-run
 * entity (legacy-Mongo backed via `crm-payroll-runs.actions`).
 *
 * Creating a run runs `generatePayrollData` + `processPayroll` for the
 * picked (month, year). Editing a run only updates the metadata
 * (status, notes, run_date) — payslips are immutable after the first
 * processing pass.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { savePayrollRun } from '@/app/actions/crm-payroll-runs.actions';
import type {
    CrmPayrollRunDoc,
    CrmPayrollRunStatus,
} from '@/app/actions/crm-payroll-runs.actions';

const BASE = '/dashboard/hrm/payroll/payroll';


const MONTHS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

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
            {isEditing ? 'Save changes' : 'Generate run'}
        </Button>
    );
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

interface PayrollRunFormProps {
    initialData?: CrmPayrollRunDoc | null;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - i + 1);

export function PayrollRunForm({ initialData }: PayrollRunFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePayrollRun, INITIAL_STATE);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
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
                    <input type="hidden" name="runId" value={initialData!._id} />
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="period_month">Period month *</Label>
                        <Select
                            name="period_month"
                            defaultValue={String(
                                initialData?.period_month ?? new Date().getMonth() + 1,
                            )}
                            disabled={isEditing}
                        >
                            <ZoruSelectTrigger id="period_month">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {MONTHS.map((m) => (
                                    <ZoruSelectItem key={m.value} value={String(m.value)}>
                                        {m.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="period_year">Period year *</Label>
                        <Select
                            name="period_year"
                            defaultValue={String(
                                initialData?.period_year ?? currentYear,
                            )}
                            disabled={isEditing}
                        >
                            <ZoruSelectTrigger id="period_year">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {YEARS.map((y) => (
                                    <ZoruSelectItem key={y} value={String(y)}>
                                        {y}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="run_date">Run date</Label>
                        <Input
                            id="run_date"
                            name="run_date"
                            type="date"
                            defaultValue={toDateInput(initialData?.run_date)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status"
                            enumName="payrollRunStatus"
                            initialId={initialData?.status ?? 'draft'}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Anything notable about this run."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {!isEditing ? (
                    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 text-[12.5px] text-zoru-ink-muted">
                        Generating a run will compute payslips for every active
                        employee in the picked period and persist them to the
                        payslips collection. Existing payslips for the same period
                        will be replaced.
                    </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to runs
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
