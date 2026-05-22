'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
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

/**
 * <InterviewForm /> — create + edit form for HR interviews.
 *
 * Binds to `saveInterview` via `useActionState`. Edit mode adds the
 * feedback / rating / recommendation fields used after the interview is
 * conducted.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityMultiFormField } from '@/components/crm/entity-multi-form-field';

import { saveInterview } from '@/app/actions/crm-interviews.actions';
import type {
    CrmInterviewDoc,
    CrmInterviewStatus,
    CrmInterviewType,
} from '@/lib/rust-client/crm-interviews';

const BASE = '/dashboard/hrm/hr/interviews';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Schedule interview'}
        </Button>
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

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="interviewId"
                        value={initialData!._id}
                    />
                ) : null}
                {/* Row 1: Candidate picker (dual-writes candidateName for legacy callers) */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Candidate *</Label>
                        {/* TODO 1E.sweep: no dedicated 'candidate' entity in lookup-registry yet — using contact as a near-match; replace with 'candidate' key once registered. */}
                        <EntityFormField
                            entity="contact"
                            name="candidateId"
                            dualWriteName="candidateName"
                            initialId={initialData?.candidateId ?? null}
                            initialLabel={initialData?.candidateName ?? ''}
                            allowCreate
                            placeholder="Select candidate"
                            required
                            disabled={isEditing}
                        />
                    </div>
                </div>

                {/* Row 2: Job + Round / Round name */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Job</Label>
                        {/* TODO 1E.sweep: no dedicated 'job' entity in lookup-registry yet — using jobTitle taxonomy as a near-match; replace once 'job' lookup is registered. */}
                        <EntityFormField
                            entity="jobTitle"
                            name="jobId"
                            initialId={initialData?.jobId ?? null}
                            allowCreate
                            placeholder="Linked job"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="round">Round</Label>
                        <Input
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
                        <Label htmlFor="roundName">Round name</Label>
                        <Input
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
                        <Label>Type</Label>
                        <EnumFormField
                            enumName="interviewType"
                            name="interviewType"
                            initialId={interviewType}
                            onChange={(id) =>
                                setInterviewType(
                                    (id as CrmInterviewType) ?? 'video',
                                )
                            }
                            placeholder="Type"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="scheduledAt">Scheduled at *</Label>
                        <Input
                            id="scheduledAt"
                            name="scheduledAt"
                            type="datetime-local"
                            required
                            defaultValue={toDateTimeLocal(initialData?.scheduledAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="durationMinutes">
                            Duration (minutes)
                        </Label>
                        <Input
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
                    <Label htmlFor="location">Location / link</Label>
                    <Input
                        id="location"
                        name="location"
                        placeholder="Video link, address, or room name"
                        defaultValue={initialData?.location ?? ''}
                    />
                </div>

                {/* Row 5: Interviewers (multi-picker dual-writes label list to interviewerNames) */}
                <div className="space-y-1.5">
                    <Label>Interviewers</Label>
                    <EntityMultiFormField
                        entity="employee"
                        name="interviewers"
                        dualWriteName="interviewerNames"
                        initialIds={
                            Array.isArray(initialData?.interviewers)
                                ? (initialData?.interviewers as string[])
                                : []
                        }
                        initialLabels={
                            Array.isArray(initialData?.interviewerNames)
                                ? (initialData?.interviewerNames as string[])
                                : []
                        }
                        allowCreate
                        placeholder="Add interviewers"
                    />
                </div>

                {/* Row 6: Status + Rating (edit only) */}
                {isEditing ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <EnumFormField
                                    enumName="interviewLifecycle"
                                    name="status"
                                    initialId={status}
                                    onChange={(id) =>
                                        setStatus(
                                            (id as CrmInterviewStatus) ??
                                                'scheduled',
                                        )
                                    }
                                    placeholder="Status"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="rating">Rating (1-5)</Label>
                                <Input
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
                                <Label>Recommendation</Label>
                                <EnumFormField
                                    enumName="interviewRecommendation"
                                    name="recommendation"
                                    initialId={recommendation || null}
                                    onChange={(id) =>
                                        setRecommendation(id ?? '')
                                    }
                                    placeholder="Recommendation"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="feedback">Feedback</Label>
                            <Textarea
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
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to interviews
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
