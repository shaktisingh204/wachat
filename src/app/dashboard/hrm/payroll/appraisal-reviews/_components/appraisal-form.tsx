'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
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
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// TODO 1E.sweep: status -> <EnumFormField enumName="appraisalStatus">; period -> <EnumFormField enumName="okrPeriod">; reviewer/employee -> <EntityFormField entity="employee">. See plan §1E.

/**
 * <AppraisalForm /> — create + edit form for appraisal reviews.
 *
 * Binds to `saveAppraisalReview` via `useActionState`. The KPI repeater
 * is a client-side editable table with add/remove rows; on submit the
 * rows are serialised as a JSON string under the `kpis` form field
 * (which the server action parses with `parseKpisJson`).
 *
 * Fields per spec:
 *   employeeName, reviewer, period,
 *   kpis (Vec<{name, target, achieved, score}> repeater),
 *   overallRating (1..5), comments, status, finalizedAt.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveAppraisalReview } from '@/app/actions/crm-appraisals.actions';
import type {
    CrmAppraisalKpi,
    CrmAppraisalReviewDoc,
    CrmAppraisalStatus,
} from '@/lib/rust-client/crm-appraisals';

const BASE = '/dashboard/hrm/payroll/appraisal-reviews';


type KpiRow = {
    name: string;
    target: string;
    achieved: string;
    score: string;
};

function toKpiRow(k: CrmAppraisalKpi): KpiRow {
    return {
        name: k.name ?? '',
        target: k.target != null ? String(k.target) : '',
        achieved: k.achieved != null ? String(k.achieved) : '',
        score: k.score != null ? String(k.score) : '',
    };
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create review'}
        </ZoruButton>
    );
}

export interface AppraisalFormProps {
    initialData?: CrmAppraisalReviewDoc | null;
}

export function AppraisalForm({ initialData }: AppraisalFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveAppraisalReview,
        INITIAL_STATE,
    );

    const [status, setStatus] = useState<CrmAppraisalStatus>(
        (initialData?.status as CrmAppraisalStatus) ?? 'draft',
    );

    const [kpis, setKpis] = useState<KpiRow[]>(() => {
        const seed = initialData?.kpis ?? [];
        return seed.length > 0 ? seed.map(toKpiRow) : [
            { name: '', target: '', achieved: '', score: '' },
        ];
    });

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

    const updateKpi = (idx: number, patch: Partial<KpiRow>) => {
        setKpis((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const addKpi = () => {
        setKpis((rows) => [
            ...rows,
            { name: '', target: '', achieved: '', score: '' },
        ]);
    };

    const removeKpi = (idx: number) => {
        setKpis((rows) =>
            rows.length <= 1
                ? [{ name: '', target: '', achieved: '', score: '' }]
                : rows.filter((_, i) => i !== idx),
        );
    };

    // Serialise to the JSON payload the server action expects. Empty
    // rows (no name) are dropped server-side.
    const kpisJson = JSON.stringify(
        kpis
            .filter((r) => r.name.trim().length > 0)
            .map((r) => ({
                name: r.name.trim(),
                target: r.target === '' ? undefined : Number(r.target),
                achieved: r.achieved === '' ? undefined : Number(r.achieved),
                score: r.score === '' ? undefined : Number(r.score),
            })),
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="reviewId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="kpis" value={kpisJson} />

                {/* Row 1: Employee name + Employee id */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            required
                            placeholder="e.g. Priya Sharma"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional — internal id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Reviewer + Period */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="reviewer">Reviewer</ZoruLabel>
                        <ZoruInput
                            id="reviewer"
                            name="reviewer"
                            placeholder="Reviewer name"
                            defaultValue={initialData?.reviewer ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="period">Period</ZoruLabel>
                        <ZoruInput
                            id="period"
                            name="period"
                            placeholder="Q1 2026 / Annual FY 25-26"
                            defaultValue={initialData?.period ?? ''}
                        />
                    </div>
                </div>

                {/* KPI repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>KPIs</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addKpi}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add KPI
                        </ZoruButton>
                    </div>
                    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Name
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted w-[120px]">
                                        Target
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted w-[120px]">
                                        Achieved
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted w-[100px]">
                                        Score
                                    </ZoruTableHead>
                                    <ZoruTableHead className="w-[40px]" />
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {kpis.map((row, i) => (
                                    <ZoruTableRow key={i} className="border-zoru-line">
                                        <ZoruTableCell>
                                            <ZoruInput
                                                value={row.name}
                                                onChange={(e) =>
                                                    updateKpi(i, { name: e.target.value })
                                                }
                                                placeholder="e.g. Onboarding throughput"
                                                className="h-8"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruInput
                                                value={row.target}
                                                onChange={(e) =>
                                                    updateKpi(i, { target: e.target.value })
                                                }
                                                type="number"
                                                step="0.01"
                                                className="h-8"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruInput
                                                value={row.achieved}
                                                onChange={(e) =>
                                                    updateKpi(i, { achieved: e.target.value })
                                                }
                                                type="number"
                                                step="0.01"
                                                className="h-8"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruInput
                                                value={row.score}
                                                onChange={(e) =>
                                                    updateKpi(i, { score: e.target.value })
                                                }
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="5"
                                                className="h-8"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeKpi(i)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </div>

                {/* Row 4: Overall rating + Status + Finalized at */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="overallRating">Overall rating (1–5)</ZoruLabel>
                        <ZoruInput
                            id="overallRating"
                            name="overallRating"
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            placeholder="1–5"
                            defaultValue={
                                initialData?.overallRating != null
                                    ? String(initialData.overallRating)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            name="status"
                            enumName="appraisalFormStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmAppraisalStatus) ?? 'draft')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="finalizedAt">Finalized at</ZoruLabel>
                        <ZoruInput
                            id="finalizedAt"
                            name="finalizedAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.finalizedAt)}
                        />
                    </div>
                </div>

                {/* Comments */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="comments">Comments</ZoruLabel>
                    <ZoruTextarea
                        id="comments"
                        name="comments"
                        rows={4}
                        placeholder="Reviewer comments, strengths, areas to grow…"
                        defaultValue={initialData?.comments ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to reviews
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
