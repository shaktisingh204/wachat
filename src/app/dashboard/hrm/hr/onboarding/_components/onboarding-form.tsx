'use client';

/**
 * <OnboardingForm /> — create + edit form for HR onboarding plans.
 *
 * Binds to `saveOnboarding` via `useActionState`. The checklist is
 * encoded as a JSON blob in a hidden field so the server action can
 * parse it back into `CrmOnboardingTask[]`.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
    LoaderCircle,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';

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

import { saveOnboarding } from '@/app/actions/crm-onboarding.actions';
import type {
    CrmOnboardingDoc,
    CrmOnboardingStatus,
    CrmOnboardingTask,
    CrmOnboardingTaskStatus,
} from '@/lib/rust-client/crm-onboarding';

const BASE = '/dashboard/hrm/hr/onboarding';

const STATUS_OPTIONS: Array<{ value: CrmOnboardingStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const TASK_STATUS_OPTIONS: Array<{
    value: CrmOnboardingTaskStatus;
    label: string;
}> = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
    { value: 'blocked', label: 'Blocked' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function newTaskId(): string {
    // Stable enough for client-side checklist row keys — the Rust crate
    // is authoritative on persistence ids.
    return `t_${Math.random().toString(36).slice(2, 10)}`;
}

interface OnboardingFormProps {
    initialData?: CrmOnboardingDoc | null;
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
            {isEditing ? 'Save changes' : 'Create onboarding'}
        </ZoruButton>
    );
}

export function OnboardingForm({ initialData }: OnboardingFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveOnboarding, initialState);

    const [status, setStatus] = useState<CrmOnboardingStatus>(
        (initialData?.status as CrmOnboardingStatus) ?? 'pending',
    );
    const [checklist, setChecklist] = useState<CrmOnboardingTask[]>(
        Array.isArray(initialData?.checklist)
            ? (initialData?.checklist ?? []).map((t) => ({
                  ...t,
                  id: t.id || newTaskId(),
              }))
            : [],
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

    const addTask = () => {
        setChecklist((prev) => [
            ...prev,
            {
                id: newTaskId(),
                title: '',
                status: 'todo',
            },
        ]);
    };

    const removeTask = (id: string) => {
        setChecklist((prev) => prev.filter((t) => t.id !== id));
    };

    const updateTask = (
        id: string,
        patch: Partial<CrmOnboardingTask>,
    ) => {
        setChecklist((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        );
    };

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="onboardingId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="checklist"
                    value={JSON.stringify(
                        checklist.filter((t) => t.title.trim().length > 0),
                    )}
                />

                {/* Row 1: Employee name + id */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeName">Employee name</ZoruLabel>
                        <ZoruInput
                            id="employeeName"
                            name="employeeName"
                            placeholder="e.g. Priya Sharma"
                            defaultValue={initialData?.employeeName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employeeId">Employee id</ZoruLabel>
                        <ZoruInput
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional — links to directory entry"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Candidate + Job ids */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="candidateId">Candidate id</ZoruLabel>
                        <ZoruInput
                            id="candidateId"
                            name="candidateId"
                            placeholder="Source candidate record id"
                            defaultValue={initialData?.candidateId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="jobId">Job id</ZoruLabel>
                        <ZoruInput
                            id="jobId"
                            name="jobId"
                            placeholder="Linked job opening"
                            defaultValue={initialData?.jobId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Department + joining date */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="departmentId">Department id</ZoruLabel>
                        <ZoruInput
                            id="departmentId"
                            name="departmentId"
                            placeholder="Optional"
                            defaultValue={initialData?.departmentId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="joiningDate">Joining date</ZoruLabel>
                        <ZoruInput
                            id="joiningDate"
                            name="joiningDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.joiningDate)}
                        />
                    </div>
                </div>

                {/* Row 4: Manager + Buddy */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="managerId">Manager id</ZoruLabel>
                        <ZoruInput
                            id="managerId"
                            name="managerId"
                            placeholder="Reporting manager user id"
                            defaultValue={initialData?.managerId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="buddyId">Buddy id</ZoruLabel>
                        <ZoruInput
                            id="buddyId"
                            name="buddyId"
                            placeholder="Onboarding buddy user id"
                            defaultValue={initialData?.buddyId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Progress + status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="progress">Progress (%)</ZoruLabel>
                        <ZoruInput
                            id="progress"
                            name="progress"
                            type="number"
                            min={0}
                            max={100}
                            placeholder="0"
                            defaultValue={
                                initialData?.progress != null
                                    ? String(initialData.progress)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmOnboardingStatus)
                            }
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

                {/* Row 6: Checklist editor */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Checklist</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addTask}
                        >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add task
                        </ZoruButton>
                    </div>
                    {checklist.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No checklist items. Click &ldquo;Add task&rdquo; to
                            create the first one.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {checklist.map((task) => (
                                <div
                                    key={task.id}
                                    className="grid items-end gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
                                >
                                    <div className="space-y-1">
                                        <ZoruLabel
                                            htmlFor={`task-title-${task.id}`}
                                            className="text-[11.5px]"
                                        >
                                            Title
                                        </ZoruLabel>
                                        <ZoruInput
                                            id={`task-title-${task.id}`}
                                            value={task.title}
                                            placeholder="e.g. Submit ID proof"
                                            onChange={(e) =>
                                                updateTask(task.id, {
                                                    title: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <ZoruLabel
                                            htmlFor={`task-due-${task.id}`}
                                            className="text-[11.5px]"
                                        >
                                            Due date
                                        </ZoruLabel>
                                        <ZoruInput
                                            id={`task-due-${task.id}`}
                                            type="date"
                                            value={toDateInput(task.dueDate)}
                                            onChange={(e) =>
                                                updateTask(task.id, {
                                                    dueDate:
                                                        e.target.value ||
                                                        undefined,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <ZoruLabel
                                            htmlFor={`task-status-${task.id}`}
                                            className="text-[11.5px]"
                                        >
                                            Status
                                        </ZoruLabel>
                                        <ZoruSelect
                                            value={task.status}
                                            onValueChange={(v) =>
                                                updateTask(task.id, {
                                                    status:
                                                        v as CrmOnboardingTaskStatus,
                                                })
                                            }
                                        >
                                            <ZoruSelectTrigger
                                                id={`task-status-${task.id}`}
                                            >
                                                <ZoruSelectValue placeholder="Status" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                {TASK_STATUS_OPTIONS.map((o) => (
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
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeTask(task.id)}
                                        aria-label="Remove task"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Row 7: Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal HR notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to onboarding
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
