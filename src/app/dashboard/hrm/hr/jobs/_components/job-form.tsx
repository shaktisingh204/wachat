'use client';

/**
 * <JobForm /> — create + edit form for HR job openings.
 *
 * Binds to the `saveJob` server action via `useActionState`. Mirrors the
 * canonical `<PolicyForm />` shape from §1B.
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

import { saveJob } from '@/app/actions/crm-jobs.actions';
import type {
    CrmJobDoc,
    CrmJobEmploymentType,
    CrmJobRemotePolicy,
    CrmJobStatus,
} from '@/lib/rust-client/crm-jobs';

const BASE = '/dashboard/hrm/hr/jobs';

const EMPLOYMENT_TYPE_OPTIONS: Array<{
    value: CrmJobEmploymentType;
    label: string;
}> = [
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Intern' },
    { value: 'temporary', label: 'Temporary' },
];

const REMOTE_POLICY_OPTIONS: Array<{
    value: CrmJobRemotePolicy;
    label: string;
}> = [
    { value: 'onsite', label: 'On-site' },
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
];

const STATUS_OPTIONS: Array<{ value: CrmJobStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'filled', label: 'Filled' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

interface JobFormProps {
    initialData?: CrmJobDoc | null;
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
            {isEditing ? 'Save changes' : 'Create job'}
        </ZoruButton>
    );
}

export function JobForm({ initialData }: JobFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveJob, initialState);

    const [employmentType, setEmploymentType] = useState<CrmJobEmploymentType>(
        (initialData?.employmentType as CrmJobEmploymentType) ?? 'full_time',
    );
    const [remotePolicy, setRemotePolicy] = useState<CrmJobRemotePolicy>(
        (initialData?.remotePolicy as CrmJobRemotePolicy) ?? 'onsite',
    );
    const [status, setStatus] = useState<CrmJobStatus>(
        (initialData?.status as CrmJobStatus) ?? 'draft',
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

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="jobId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="employmentType" value={employmentType} />
                <input type="hidden" name="remotePolicy" value={remotePolicy} />
                <input type="hidden" name="status" value={status} />

                {/* Row 1: Title + Openings */}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="title">Title *</ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            required
                            placeholder="e.g. Senior Frontend Engineer"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="openings">Openings</ZoruLabel>
                        <ZoruInput
                            id="openings"
                            name="openings"
                            type="number"
                            min={1}
                            placeholder="1"
                            defaultValue={
                                initialData?.openings != null
                                    ? String(initialData.openings)
                                    : '1'
                            }
                        />
                    </div>
                </div>

                {/* Row 2: Department + Location */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="departmentName">Department</ZoruLabel>
                        <ZoruInput
                            id="departmentName"
                            name="departmentName"
                            placeholder="e.g. Engineering"
                            defaultValue={initialData?.departmentName ?? ''}
                        />
                        <input
                            type="hidden"
                            name="departmentId"
                            defaultValue={initialData?.departmentId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="location">Location</ZoruLabel>
                        <ZoruInput
                            id="location"
                            name="location"
                            placeholder="e.g. Bengaluru, IN"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Employment type + Remote policy + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="employmentType-trigger">
                            Employment type
                        </ZoruLabel>
                        <ZoruSelect
                            value={employmentType}
                            onValueChange={(v) =>
                                setEmploymentType(v as CrmJobEmploymentType)
                            }
                        >
                            <ZoruSelectTrigger id="employmentType-trigger">
                                <ZoruSelectValue placeholder="Type" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="remotePolicy-trigger">Work mode</ZoruLabel>
                        <ZoruSelect
                            value={remotePolicy}
                            onValueChange={(v) =>
                                setRemotePolicy(v as CrmJobRemotePolicy)
                            }
                        >
                            <ZoruSelectTrigger id="remotePolicy-trigger">
                                <ZoruSelectValue placeholder="Work mode" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {REMOTE_POLICY_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmJobStatus)}
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

                {/* Row 4: Experience range */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="experienceMin">Experience min (yrs)</ZoruLabel>
                        <ZoruInput
                            id="experienceMin"
                            name="experienceMin"
                            type="number"
                            min={0}
                            placeholder="0"
                            defaultValue={
                                initialData?.experienceMin != null
                                    ? String(initialData.experienceMin)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="experienceMax">Experience max (yrs)</ZoruLabel>
                        <ZoruInput
                            id="experienceMax"
                            name="experienceMax"
                            type="number"
                            min={0}
                            placeholder="10"
                            defaultValue={
                                initialData?.experienceMax != null
                                    ? String(initialData.experienceMax)
                                    : ''
                            }
                        />
                    </div>
                </div>

                {/* Row 5: Salary range + Currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="salaryMin">Salary min</ZoruLabel>
                        <ZoruInput
                            id="salaryMin"
                            name="salaryMin"
                            type="number"
                            min={0}
                            placeholder="500000"
                            defaultValue={
                                initialData?.salaryMin != null
                                    ? String(initialData.salaryMin)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="salaryMax">Salary max</ZoruLabel>
                        <ZoruInput
                            id="salaryMax"
                            name="salaryMax"
                            type="number"
                            min={0}
                            placeholder="900000"
                            defaultValue={
                                initialData?.salaryMax != null
                                    ? String(initialData.salaryMax)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                        <ZoruInput
                            id="currency"
                            name="currency"
                            placeholder="INR"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                </div>

                {/* Row 6: Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Short summary of the role."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 7: Responsibilities */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="responsibilities">Responsibilities</ZoruLabel>
                    <ZoruTextarea
                        id="responsibilities"
                        name="responsibilities"
                        rows={5}
                        placeholder="• Build…&#10;• Own…&#10;• Mentor…"
                        defaultValue={initialData?.responsibilities ?? ''}
                    />
                </div>

                {/* Row 8: Requirements */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="requirements">Requirements</ZoruLabel>
                    <ZoruTextarea
                        id="requirements"
                        name="requirements"
                        rows={5}
                        placeholder="• 4+ years…&#10;• Strong in…"
                        defaultValue={initialData?.requirements ?? ''}
                    />
                </div>

                {/* Row 9: Dates + Hiring manager */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="publishAt">Publish at</ZoruLabel>
                        <ZoruInput
                            id="publishAt"
                            name="publishAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.publishAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="closeAt">Close at</ZoruLabel>
                        <ZoruInput
                            id="closeAt"
                            name="closeAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.closeAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="hiringManagerId">
                            Hiring manager id
                        </ZoruLabel>
                        <ZoruInput
                            id="hiringManagerId"
                            name="hiringManagerId"
                            placeholder="Optional"
                            defaultValue={initialData?.hiringManagerId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 10: Publish URL + Filled (edit only) + Tags */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="publishUrl">Public posting URL</ZoruLabel>
                        <ZoruInput
                            id="publishUrl"
                            name="publishUrl"
                            placeholder="https://careers.example.com/jobs/…"
                            defaultValue={initialData?.publishUrl ?? ''}
                        />
                    </div>
                    {isEditing ? (
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="filled">Filled</ZoruLabel>
                            <ZoruInput
                                id="filled"
                                name="filled"
                                type="number"
                                min={0}
                                defaultValue={
                                    initialData?.filled != null
                                        ? String(initialData.filled)
                                        : '0'
                                }
                            />
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                            <ZoruInput
                                id="tags"
                                name="tags"
                                placeholder="comma, separated, tags"
                                defaultValue={tagsInitial}
                            />
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                        <ZoruInput
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                ) : null}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to jobs
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
