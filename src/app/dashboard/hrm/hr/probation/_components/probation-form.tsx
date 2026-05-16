'use client';

/**
 * <ProbationForm /> — create + edit form for HR probation records.
 *
 * Binds to the `saveCrmProbation` server action via `useActionState`. The
 * criteria repeater is a structured list of objective rows
 * `{ name, target, achieved, score }` that gets serialised to JSON
 * via a hidden input on submit.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';

import {
    saveCrmProbation,
    type CrmProbationDoc,
    type ProbationCriterion,
    type ProbationRecommendation,
    type ProbationStatus,
} from '@/app/actions/crm-probation.actions';

const BASE = '/dashboard/hrm/hr/probation';

const STATUS_OPTIONS: Array<{ value: ProbationStatus; label: string }> = [
    { value: 'in_progress', label: 'In progress' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'extended', label: 'Extended' },
    { value: 'terminated', label: 'Terminated' },
    { value: 'archived', label: 'Archived' },
];

const RECOMMENDATION_OPTIONS: Array<{
    value: '' | ProbationRecommendation;
    label: string;
}> = [
    { value: '', label: '— None —' },
    { value: 'confirm', label: 'Confirm' },
    { value: 'extend', label: 'Extend' },
    { value: 'terminate', label: 'Terminate' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface ProbationFormProps {
    initialData?: (Partial<CrmProbationDoc> & { _id?: string | { toString(): string } }) | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create probation'}
        </ZoruButton>
    );
}

export function ProbationForm({ initialData }: ProbationFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const recordId = initialData?._id
        ? typeof initialData._id === 'string'
            ? initialData._id
            : initialData._id.toString()
        : '';
    const isEditing = !!recordId;

    const [state, formAction] = useActionState(saveCrmProbation, initialState);

    const [status, setStatus] = useState<ProbationStatus>(
        (initialData?.status as ProbationStatus) ?? 'in_progress',
    );
    const [recommendation, setRecommendation] = useState<
        '' | ProbationRecommendation
    >((initialData?.recommendation as ProbationRecommendation) ?? '');

    const [criteria, setCriteria] = useState<ProbationCriterion[]>(() => {
        const raw = initialData?.criteria;
        if (Array.isArray(raw) && raw.length > 0) return raw as ProbationCriterion[];
        return [{ name: '', target: '', achieved: '', score: undefined }];
    });

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? recordId;
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, recordId]);

    const addCriterion = () =>
        setCriteria((prev) => [
            ...prev,
            { name: '', target: '', achieved: '', score: undefined },
        ]);

    const removeCriterion = (idx: number) =>
        setCriteria((prev) => prev.filter((_, i) => i !== idx));

    const updateCriterion = <K extends keyof ProbationCriterion>(
        idx: number,
        key: K,
        value: ProbationCriterion[K],
    ) =>
        setCriteria((prev) =>
            prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
        );

    const cleanCriteriaJson = JSON.stringify(
        criteria
            .map((c) => ({
                name: c.name?.trim() ?? '',
                target: c.target?.trim() || undefined,
                achieved: c.achieved?.trim() || undefined,
                score:
                    typeof c.score === 'number' && Number.isFinite(c.score)
                        ? c.score
                        : undefined,
            }))
            .filter((c) => c.name.length > 0),
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="probationId" value={recordId} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="recommendation" value={recommendation} />
                <input type="hidden" name="criteria" value={cleanCriteriaJson} />

                {/* Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name *</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="Full name"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee ID</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="HR employee id"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="startDate">Start date</ZoruLabel>
                        <ZoruInput
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.startDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="endDate">End date</ZoruLabel>
                        <ZoruInput
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.endDate)}
                        />
                    </div>
                </div>

                {/* Evaluator */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="evaluatorName">Evaluator name</ZoruLabel>
                        <ZoruInput
                            id="evaluatorName"
                            name="evaluatorName"
                            placeholder="Reporting manager"
                            defaultValue={initialData?.evaluatorName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="evaluatorId">Evaluator ID</ZoruLabel>
                        <ZoruInput
                            id="evaluatorId"
                            name="evaluatorId"
                            placeholder="User id"
                            defaultValue={initialData?.evaluatorId ?? ''}
                        />
                    </div>
                </div>

                {/* Criteria repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Evaluation criteria</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addCriterion}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add criterion
                        </ZoruButton>
                    </div>

                    <div className="flex flex-col gap-2">
                        {criteria.map((c, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-1 gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]"
                            >
                                <ZoruInput
                                    placeholder="Criterion name"
                                    value={c.name}
                                    onChange={(e) =>
                                        updateCriterion(idx, 'name', e.target.value)
                                    }
                                />
                                <ZoruInput
                                    placeholder="Target"
                                    value={c.target ?? ''}
                                    onChange={(e) =>
                                        updateCriterion(idx, 'target', e.target.value)
                                    }
                                />
                                <ZoruInput
                                    placeholder="Achieved"
                                    value={c.achieved ?? ''}
                                    onChange={(e) =>
                                        updateCriterion(idx, 'achieved', e.target.value)
                                    }
                                />
                                <ZoruInput
                                    type="number"
                                    step="0.1"
                                    placeholder="Score"
                                    value={c.score ?? ''}
                                    onChange={(e) => {
                                        const s = e.target.value.trim();
                                        const n = s === '' ? undefined : Number(s);
                                        updateCriterion(
                                            idx,
                                            'score',
                                            Number.isFinite(n) ? (n as number) : undefined,
                                        );
                                    }}
                                />
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeCriterion(idx)}
                                    disabled={criteria.length === 1}
                                    aria-label="Remove criterion"
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </ZoruButton>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Overall score + Recommendation */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="overallScore">Overall score</ZoruLabel>
                        <ZoruInput
                            id="overallScore"
                            name="overallScore"
                            type="number"
                            step="0.1"
                            placeholder="0 — 5"
                            defaultValue={
                                initialData?.overallScore != null
                                    ? String(initialData.overallScore)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="recommendation-trigger">
                            Recommendation
                        </ZoruLabel>
                        <ZoruSelect
                            value={recommendation || 'none'}
                            onValueChange={(v) =>
                                setRecommendation(
                                    v === 'none' ? '' : (v as ProbationRecommendation),
                                )
                            }
                        >
                            <ZoruSelectTrigger id="recommendation-trigger">
                                <ZoruSelectValue placeholder="—" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {RECOMMENDATION_OPTIONS.map((o) => (
                                    <ZoruSelectItem
                                        key={o.value || 'none'}
                                        value={o.value || 'none'}
                                    >
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Status + Notes */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as ProbationStatus)}
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea
                            id="notes"
                            name="notes"
                            rows={3}
                            defaultValue={initialData?.notes ?? ''}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to probation
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
