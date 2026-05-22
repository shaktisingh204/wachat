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
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// §1E.sweep: OKR status Select kept — form uses behind/missed slugs; okrStatus enum has off_track/cancelled. Resolve Rust DTO first.
// §1E.sweep: period Select — okrPeriod enum (q1/q2/q3/q4/h1/h2/annual) matches; can be migrated once status is resolved.

/**
 * <OkrForm /> — create + edit form for OKRs.
 *
 * Binds to the `saveOkr` server action via `useActionState`. Key results
 * are a structured array — we serialise them to a hidden JSON input so the
 * server action can decode without needing FormData repeat-key gymnastics.
 */

import { saveOkr } from '@/app/actions/crm-okrs.actions';
import type {
    CrmOkrDoc,
    CrmOkrKeyResult,
    CrmOkrKeyResultStatus,
    CrmOkrStatus,
} from '@/lib/rust-client/crm-okrs';

const BASE = '/dashboard/hrm/hr/okrs';

const STATUS_OPTIONS: Array<{ value: CrmOkrStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'on_track', label: 'On track' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'behind', label: 'Behind' },
    { value: 'completed', label: 'Completed' },
    { value: 'missed', label: 'Missed' },
    { value: 'archived', label: 'Archived' },
];

const KR_STATUS_OPTIONS: Array<{ value: CrmOkrKeyResultStatus; label: string }> = [
    { value: 'on_track', label: 'On track' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'behind', label: 'Behind' },
    { value: 'completed', label: 'Completed' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function newKrId(): string {
    return `kr_${Math.random().toString(36).slice(2, 10)}`;
}

interface OkrFormProps {
    initialData?: CrmOkrDoc | null;
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
            {isEditing ? 'Save changes' : 'Create OKR'}
        </ZoruButton>
    );
}

export function OkrForm({ initialData }: OkrFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveOkr, initialState);

    const [status, setStatus] = useState<CrmOkrStatus>(
        (initialData?.status as CrmOkrStatus) ?? 'draft',
    );
    const [keyResults, setKeyResults] = useState<CrmOkrKeyResult[]>(
        Array.isArray(initialData?.keyResults) ? (initialData!.keyResults as CrmOkrKeyResult[]) : [],
    );

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

    const addKr = () => {
        setKeyResults((krs) => [
            ...krs,
            { id: newKrId(), title: '', status: 'on_track' },
        ]);
    };

    const removeKr = (id: string) => {
        setKeyResults((krs) => krs.filter((kr) => kr.id !== id));
    };

    const updateKr = <K extends keyof CrmOkrKeyResult>(
        id: string,
        field: K,
        value: CrmOkrKeyResult[K],
    ) => {
        setKeyResults((krs) =>
            krs.map((kr) => (kr.id === id ? { ...kr, [field]: value } : kr)),
        );
    };

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="okrId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="keyResults"
                    value={JSON.stringify(keyResults)}
                />

                {/* Row 1: Objective */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="objective">Objective *</ZoruLabel>
                    <ZoruInput
                        id="objective"
                        name="objective"
                        required
                        placeholder="e.g. Improve customer satisfaction score"
                        defaultValue={initialData?.objective ?? ''}
                    />
                </div>

                {/* Row 2: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Optional — context for this objective."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 3: Period + Owner */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="period">Period</ZoruLabel>
                        <ZoruInput
                            id="period"
                            name="period"
                            placeholder="e.g. 2026-Q2"
                            defaultValue={initialData?.period ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="ownerName">Owner name</ZoruLabel>
                        <ZoruInput
                            id="ownerName"
                            name="ownerName"
                            placeholder="Display name"
                            defaultValue={initialData?.ownerName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Owner id + Team / Department */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="ownerId">Owner (user id)</ZoruLabel>
                        <ZoruInput
                            id="ownerId"
                            name="ownerId"
                            placeholder="Optional"
                            defaultValue={initialData?.ownerId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="teamId">Team id</ZoruLabel>
                        <ZoruInput
                            id="teamId"
                            name="teamId"
                            placeholder="Optional"
                            defaultValue={initialData?.teamId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="departmentId">Department id</ZoruLabel>
                        <ZoruInput
                            id="departmentId"
                            name="departmentId"
                            placeholder="Optional"
                            defaultValue={initialData?.departmentId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Dates + parent */}
                <div className="grid gap-4 sm:grid-cols-3">
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
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="parentOkrId">Parent OKR id</ZoruLabel>
                        <ZoruInput
                            id="parentOkrId"
                            name="parentOkrId"
                            placeholder="Optional"
                            defaultValue={initialData?.parentOkrId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 6: Progress + Confidence + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="progress">Progress %</ZoruLabel>
                        <ZoruInput
                            id="progress"
                            name="progress"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0–100"
                            defaultValue={
                                typeof initialData?.progress === 'number'
                                    ? String(initialData.progress)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="confidence">Confidence %</ZoruLabel>
                        <ZoruInput
                            id="confidence"
                            name="confidence"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="0–100"
                            defaultValue={
                                typeof initialData?.confidence === 'number'
                                    ? String(initialData.confidence)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmOkrStatus)}
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
                </div>

                {/* Row 7: Tags */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                    <ZoruInput
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

                {/* Key Results editor */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Key results</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addKr}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add KR
                        </ZoruButton>
                    </div>
                    {keyResults.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No key results yet. Click &ldquo;Add KR&rdquo; to add one.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {keyResults.map((kr) => (
                                <div
                                    key={kr.id}
                                    className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3"
                                >
                                    <div className="mb-2 flex items-start gap-2">
                                        <div className="flex-1 space-y-1.5">
                                            <ZoruLabel htmlFor={`kr-title-${kr.id}`}>
                                                Title *
                                            </ZoruLabel>
                                            <ZoruInput
                                                id={`kr-title-${kr.id}`}
                                                value={kr.title}
                                                onChange={(e) =>
                                                    updateKr(kr.id, 'title', e.target.value)
                                                }
                                                placeholder="Ship feature X"
                                            />
                                        </div>
                                        <ZoruButton
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeKr(kr.id)}
                                            aria-label="Remove key result"
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </ZoruButton>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-4">
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Metric</ZoruLabel>
                                            <ZoruInput
                                                value={kr.metric ?? ''}
                                                onChange={(e) =>
                                                    updateKr(kr.id, 'metric', e.target.value)
                                                }
                                                placeholder="NPS"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Target</ZoruLabel>
                                            <ZoruInput
                                                type="number"
                                                value={
                                                    typeof kr.targetValue === 'number'
                                                        ? String(kr.targetValue)
                                                        : ''
                                                }
                                                onChange={(e) =>
                                                    updateKr(
                                                        kr.id,
                                                        'targetValue',
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value),
                                                    )
                                                }
                                                placeholder="80"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Current</ZoruLabel>
                                            <ZoruInput
                                                type="number"
                                                value={
                                                    typeof kr.currentValue === 'number'
                                                        ? String(kr.currentValue)
                                                        : ''
                                                }
                                                onChange={(e) =>
                                                    updateKr(
                                                        kr.id,
                                                        'currentValue',
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value),
                                                    )
                                                }
                                                placeholder="62"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <ZoruLabel>Status</ZoruLabel>
                                            <ZoruSelect
                                                value={kr.status}
                                                onValueChange={(v) =>
                                                    updateKr(
                                                        kr.id,
                                                        'status',
                                                        v as CrmOkrKeyResultStatus,
                                                    )
                                                }
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {KR_STATUS_OPTIONS.map((o) => (
                                                        <ZoruSelectItem
                                                            key={o.value}
                                                            value={o.value}
                                                        >
                                                            {o.label}
                                                        </ZoruSelectItem>
                                                    ))}
                                                </ZoruSelectContent>
                                            </ZoruSelect>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to OKRs
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
