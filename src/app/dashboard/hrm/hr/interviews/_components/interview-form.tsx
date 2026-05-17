'use client';

/**
 * <InterviewForm /> — create + edit form for HR interviews.
 *
 * Binds to `saveInterview` via `useActionState`. Edit mode adds the
 * feedback / rating / recommendation fields used after the interview is
 * conducted.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

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

import { saveInterview } from '@/app/actions/crm-interviews.actions';
import type {
    CrmInterviewDoc,
    CrmInterviewRecommendation,
    CrmInterviewStatus,
    CrmInterviewType,
} from '@/lib/rust-client/crm-interviews';

const BASE = '/dashboard/hrm/hr/interviews';

const TYPE_OPTIONS: Array<{ value: CrmInterviewType; label: string }> = [
    { value: 'phone', label: 'Phone' },
    { value: 'video', label: 'Video' },
    { value: 'onsite', label: 'Onsite' },
    { value: 'async_assessment', label: 'Async assessment' },
];

const STATUS_OPTIONS: Array<{ value: CrmInterviewStatus; label: string }> = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'rescheduled', label: 'Rescheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'no_show', label: 'No show' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
];

const RECOMMENDATION_OPTIONS: Array<{
    value: CrmInterviewRecommendation | '';
    label: string;
}> = [
    { value: '', label: '—' },
    { value: 'strong_hire', label: 'Strong hire' },
    { value: 'hire', label: 'Hire' },
    { value: 'no_hire', label: 'No hire' },
    { value: 'strong_no_hire', label: 'Strong no hire' },
];

/** Convert an ISO datetime into the `YYYY-MM-DDTHH:mm` form `datetime-local` expects. */
function toDateTimeLocal(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface InterviewFormProps {
    initialData?: CrmInterviewDoc | null;
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
            {isEditing ? 'Save changes' : 'Schedule interview'}
        </ZoruButton>
    );
}

export function InterviewForm({ initialData }: InterviewFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveInterview, initialState);

    const [interviewType, setInterviewType] = useState<CrmInterviewType>(
        (initialData?.interviewType as CrmInterviewType) ?? 'video',
    );
    const [status, setStatus] = useState<CrmInterviewStatus>(
        (initialData?.status as CrmInterviewStatus) ?? 'scheduled',
    );
    const [recommendation, setRecommendation] = useState<string>(
        (initialData?.recommendation as string) ?? '',
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

    const interviewersInitial = Array.isArray(initialData?.interviewers)
        ? (initialData?.interviewers ?? []).join(', ')
        : '';
    const interviewerNamesInitial = Array.isArray(initialData?.interviewerNames)
        ? (initialData?.interviewerNames ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="interviewId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="interviewType" value={interviewType} />
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="recommendation"
                    value={recommendation}
                />

                {/* Row 1: Candidate id + name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="candidateId">Candidate id *</ZoruLabel>
                        <ZoruInput
                            id="candidateId"
                            name="candidateId"
                            required
                            placeholder="Candidate record id"
                            defaultValue={initialData?.candidateId ?? ''}
                            readOnly={isEditing}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="candidateName">Candidate name</ZoruLabel>
                        <ZoruInput
                            id="candidateName"
                            name="candidateName"
                            placeholder="e.g. Priya Sharma"
                            defaultValue={initialData?.candidateName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Job id + Round / Round name */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="jobId">Job id</ZoruLabel>
                        <ZoruInput
                            id="jobId"
                            name="jobId"
                            placeholder="Optional"
                            defaultValue={initialData?.jobId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="round">Round</ZoruLabel>
                        <ZoruInput
                            id="round"
                            name="round"
                            type="number"
                            min={1}
                            placeholder="1"
                            defaultValue={
                                initialData?.round != null
                                    ? String(initialData.round)
                                    : '1'
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="roundName">Round name</ZoruLabel>
                        <ZoruInput
                            id="roundName"
                            name="roundName"
                            placeholder="e.g. Tech screen"
                            defaultValue={initialData?.roundName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Type + Scheduled at + Duration */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="type-trigger">Type</ZoruLabel>
                        <ZoruSelect
                            value={interviewType}
                            onValueChange={(v) =>
                                setInterviewType(v as CrmInterviewType)
                            }
                        >
                            <ZoruSelectTrigger id="type-trigger">
                                <ZoruSelectValue placeholder="Type" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TYPE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="scheduledAt">Scheduled at *</ZoruLabel>
                        <ZoruInput
                            id="scheduledAt"
                            name="scheduledAt"
                            type="datetime-local"
                            required
                            defaultValue={toDateTimeLocal(initialData?.scheduledAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="durationMinutes">
                            Duration (minutes)
                        </ZoruLabel>
                        <ZoruInput
                            id="durationMinutes"
                            name="durationMinutes"
                            type="number"
                            min={5}
                            placeholder="60"
                            defaultValue={
                                initialData?.durationMinutes != null
                                    ? String(initialData.durationMinutes)
                                    : '60'
                            }
                        />
                    </div>
                </div>

                {/* Row 4: Location */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="location">Location / link</ZoruLabel>
                    <ZoruInput
                        id="location"
                        name="location"
                        placeholder="Video link, address, or room name"
                        defaultValue={initialData?.location ?? ''}
                    />
                </div>

                {/* Row 5: Interviewers (ids + names) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="interviewers">
                            Interviewer ids
                        </ZoruLabel>
                        <ZoruInput
                            id="interviewers"
                            name="interviewers"
                            placeholder="user1, user2, user3"
                            defaultValue={interviewersInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="interviewerNames">
                            Interviewer names
                        </ZoruLabel>
                        <ZoruInput
                            id="interviewerNames"
                            name="interviewerNames"
                            placeholder="Alice, Bob, Carol"
                            defaultValue={interviewerNamesInitial}
                        />
                    </div>
                </div>

                {/* Row 6: Status + Rating (edit only) */}
                {isEditing ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                                <ZoruSelect
                                    value={status}
                                    onValueChange={(v) =>
                                        setStatus(v as CrmInterviewStatus)
                                    }
                                >
                                    <ZoruSelectTrigger id="status-trigger">
                                        <ZoruSelectValue placeholder="Status" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {STATUS_OPTIONS.map((o) => (
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
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="rating">Rating (1-5)</ZoruLabel>
                                <ZoruInput
                                    id="rating"
                                    name="rating"
                                    type="number"
                                    min={1}
                                    max={5}
                                    step={0.5}
                                    placeholder="4"
                                    defaultValue={
                                        initialData?.rating != null
                                            ? String(initialData.rating)
                                            : ''
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="rec-trigger">
                                    Recommendation
                                </ZoruLabel>
                                <ZoruSelect
                                    value={recommendation || '__none'}
                                    onValueChange={(v) =>
                                        setRecommendation(v === '__none' ? '' : v)
                                    }
                                >
                                    <ZoruSelectTrigger id="rec-trigger">
                                        <ZoruSelectValue placeholder="Recommendation" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {RECOMMENDATION_OPTIONS.map((o) => (
                                            <ZoruSelectItem
                                                key={o.value || '__none'}
                                                value={o.value || '__none'}
                                            >
                                                {o.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="feedback">Feedback</ZoruLabel>
                            <ZoruTextarea
                                id="feedback"
                                name="feedback"
                                rows={4}
                                placeholder="Interviewer notes captured after the interview."
                                defaultValue={initialData?.feedback ?? ''}
                            />
                        </div>
                    </>
                ) : null}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to interviews
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
