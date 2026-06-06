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
  Save } from 'lucide-react';

/**
 * <JobForm /> — create + edit form for HR job openings.
 *
 * Binds to the `saveJob` server action via `useActionState`. Mirrors the
 * canonical `<PolicyForm />` shape from §1B.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveJob } from '@/app/actions/crm-jobs.actions';
import type {
    CrmJobDoc,
    CrmJobEmploymentType,
    CrmJobRemotePolicy,
    CrmJobStatus,
} from '@/lib/rust-client/crm-jobs';

const BASE = '/dashboard/hrm/hr/jobs';

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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create job'}
        </Button>
    );
}

export function JobForm({ initialData }: JobFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="jobId" value={initialData!._id} />
                ) : null}

                {/* Row 1: Title + Openings */}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            name="title"
                            required
                            placeholder="e.g. Senior Frontend Engineer"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="openings">Openings</Label>
                        <Input
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
                        <Label>Department</Label>
                        <EntityFormField
                            entity="department"
                            name="departmentId"
                            dualWriteName="departmentName"
                            initialId={initialData?.departmentId ?? null}
                            initialLabel={initialData?.departmentName ?? ''}
                            allowCreate
                            placeholder="Select department"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="e.g. Bengaluru, IN"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Employment type + Work mode + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Employment type</Label>
                        <EnumFormField
                            enumName="jobEmploymentType"
                            name="employmentType"
                            initialId={employmentType}
                            onChange={(id) =>
                                setEmploymentType(
                                    (id as CrmJobEmploymentType) ?? 'full_time',
                                )
                            }
                            placeholder="Type"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Work mode</Label>
                        <EnumFormField
                            enumName="jobWorkMode"
                            name="remotePolicy"
                            initialId={remotePolicy === 'onsite' ? 'on_site' : remotePolicy}
                            onChange={(id) => {
                                const mapped =
                                    id === 'on_site' ? 'onsite' : (id as CrmJobRemotePolicy);
                                setRemotePolicy(mapped ?? 'onsite');
                            }}
                            placeholder="Work mode"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="jobStatus"
                            name="status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus((id as CrmJobStatus) ?? 'draft')
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 4: Experience range */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="experienceMin">Experience min (yrs)</Label>
                        <Input
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
                        <Label htmlFor="experienceMax">Experience max (yrs)</Label>
                        <Input
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
                        <Label htmlFor="salaryMin">Salary min</Label>
                        <Input
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
                        <Label htmlFor="salaryMax">Salary max</Label>
                        <Input
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
                        <Label>Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={initialData?.currency ?? 'INR'}
                            allowCreate
                            placeholder="INR"
                        />
                    </div>
                </div>

                {/* Row 6: Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Short summary of the role."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 7: Responsibilities */}
                <div className="space-y-1.5">
                    <Label htmlFor="responsibilities">Responsibilities</Label>
                    <Textarea
                        id="responsibilities"
                        name="responsibilities"
                        rows={5}
                        placeholder="• Build…&#10;• Own…&#10;• Mentor…"
                        defaultValue={initialData?.responsibilities ?? ''}
                    />
                </div>

                {/* Row 8: Requirements */}
                <div className="space-y-1.5">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
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
                        <Label htmlFor="publishAt">Publish at</Label>
                        <Input
                            id="publishAt"
                            name="publishAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.publishAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="closeAt">Close at</Label>
                        <Input
                            id="closeAt"
                            name="closeAt"
                            type="date"
                            defaultValue={toDateInput(initialData?.closeAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Hiring manager</Label>
                        <EntityFormField
                            entity="employee"
                            name="hiringManagerId"
                            initialId={initialData?.hiringManagerId ?? null}
                            allowCreate
                            placeholder="Hiring manager"
                        />
                    </div>
                </div>

                {/* Row 10: Publish URL + Filled (edit only) + Tags */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="publishUrl">Public posting URL</Label>
                        <Input
                            id="publishUrl"
                            name="publishUrl"
                            placeholder="https://careers.example.com/jobs/…"
                            defaultValue={initialData?.publishUrl ?? ''}
                        />
                    </div>
                    {isEditing ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="filled">Filled</Label>
                            <Input
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
                            <Label htmlFor="tags">Tags</Label>
                            <Input
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
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                ) : null}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to jobs
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
