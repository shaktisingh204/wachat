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
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <CandidateForm /> — create + edit form for HR candidates.
 *
 * Binds to `saveCandidate` via `useActionState`. The `resume_url` slot
 * uses `<SabFilePickerButton>` because SabFiles policy forbids any
 * free-text URL paste for file inputs.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';

import { saveCandidate } from '@/app/actions/crm-candidates.actions';
import type {
    CrmCandidateDoc,
    CrmCandidateSource,
    CrmCandidateStage,
} from '@/lib/rust-client/crm-candidates';

const BASE = '/dashboard/hrm/hr/candidates';

interface CandidateFormProps {
    initialData?: CrmCandidateDoc | null;
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
            {isEditing ? 'Save changes' : 'Create candidate'}
        </ZoruButton>
    );
}

export function CandidateForm({ initialData }: CandidateFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveCandidate, initialState);

    const [resumeUrl, setResumeUrl] = useState<string>(
        initialData?.resumeUrl ?? '',
    );
    const [resumeName, setResumeName] = useState<string>(() => {
        const u = initialData?.resumeUrl;
        if (!u) return '';
        try {
            const path = new URL(u, 'http://x').pathname;
            return decodeURIComponent(path.split('/').pop() ?? '') || u;
        } catch {
            return u;
        }
    });

    const [stage, setStage] = useState<CrmCandidateStage>(
        (initialData?.stage as CrmCandidateStage) ?? 'applied',
    );
    const [source, setSource] = useState<CrmCandidateSource | ''>(
        (initialData?.source as CrmCandidateSource | '') ?? '',
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

    const onPickResume = (pick: SabFilePick) => {
        setResumeUrl(pick.url);
        setResumeName(pick.name);
    };
    const clearResume = () => {
        setResumeUrl('');
        setResumeName('');
    };

    const skillsInitial = Array.isArray(initialData?.skills)
        ? (initialData?.skills ?? []).join(', ')
        : '';
    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="candidateId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="resumeUrl" value={resumeUrl} />

                {/* Row 1: First + last name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="firstName">First name *</ZoruLabel>
                        <ZoruInput
                            id="firstName"
                            name="firstName"
                            required
                            placeholder="e.g. Priya"
                            defaultValue={initialData?.firstName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="lastName">Last name</ZoruLabel>
                        <ZoruInput
                            id="lastName"
                            name="lastName"
                            placeholder="e.g. Sharma"
                            defaultValue={initialData?.lastName ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Email + phone */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="email">Email *</ZoruLabel>
                        <ZoruInput
                            id="email"
                            name="email"
                            type="email"
                            required
                            placeholder="name@example.com"
                            defaultValue={initialData?.email ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                        <ZoruInput
                            id="phone"
                            name="phone"
                            placeholder="+91-…"
                            defaultValue={initialData?.phone ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Current company + title */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currentCompany">
                            Current company
                        </ZoruLabel>
                        <ZoruInput
                            id="currentCompany"
                            name="currentCompany"
                            placeholder="e.g. Acme Corp"
                            defaultValue={initialData?.currentCompany ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="currentTitle">
                            Current title
                        </ZoruLabel>
                        <ZoruInput
                            id="currentTitle"
                            name="currentTitle"
                            placeholder="e.g. Senior Engineer"
                            defaultValue={initialData?.currentTitle ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Location + Job id */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="location">Location</ZoruLabel>
                        <ZoruInput
                            id="location"
                            name="location"
                            placeholder="e.g. Bengaluru, IN"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="jobId">Linked job id</ZoruLabel>
                        <ZoruInput
                            id="jobId"
                            name="jobId"
                            placeholder="Optional"
                            defaultValue={initialData?.jobId ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Stage + Source */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Stage</ZoruLabel>
                        <EnumFormField
                            enumName="candidateStage"
                            name="stage"
                            initialId={stage}
                            onChange={(id) =>
                                setStage(
                                    (id as CrmCandidateStage) ?? 'applied',
                                )
                            }
                            placeholder="Stage"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Source</ZoruLabel>
                        <EnumFormField
                            enumName="candidateSource"
                            name="source"
                            initialId={source || null}
                            onChange={(id) =>
                                setSource((id as CrmCandidateSource | '') ?? '')
                            }
                            placeholder="Source"
                        />
                    </div>
                </div>

                {/* Row 6: Resume (SabFile) */}
                <div className="space-y-1.5">
                    <ZoruLabel>Resume</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickResume}
                            title="Pick a resume"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {resumeUrl
                                ? 'Replace resume'
                                : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {resumeUrl ? (
                            <>
                                <a
                                    href={resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {resumeName || resumeUrl}
                                </a>
                                <ZoruButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearResume}
                                >
                                    Remove
                                </ZoruButton>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No resume attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 7: Experience + expected salary + currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="experienceYears">
                            Experience (yrs)
                        </ZoruLabel>
                        <ZoruInput
                            id="experienceYears"
                            name="experienceYears"
                            type="number"
                            min={0}
                            placeholder="5"
                            defaultValue={
                                initialData?.experienceYears != null
                                    ? String(initialData.experienceYears)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="expectedSalary">
                            Expected salary
                        </ZoruLabel>
                        <ZoruInput
                            id="expectedSalary"
                            name="expectedSalary"
                            type="number"
                            min={0}
                            placeholder="1500000"
                            defaultValue={
                                initialData?.expectedSalary != null
                                    ? String(initialData.expectedSalary)
                                    : ''
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Currency</ZoruLabel>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={initialData?.currency ?? 'INR'}
                            allowCreate
                            placeholder="INR"
                        />
                    </div>
                </div>

                {/* Row 8: Skills + Rating */}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="skills">Skills</ZoruLabel>
                        <ZoruInput
                            id="skills"
                            name="skills"
                            placeholder="react, typescript, node"
                            defaultValue={skillsInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="rating">Rating (1-5)</ZoruLabel>
                        <ZoruInput
                            id="rating"
                            name="rating"
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            placeholder="3.5"
                            defaultValue={
                                initialData?.rating != null
                                    ? String(initialData.rating)
                                    : ''
                            }
                        />
                    </div>
                </div>

                {/* Row 9: Cover letter */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="coverLetter">Cover letter</ZoruLabel>
                    <ZoruTextarea
                        id="coverLetter"
                        name="coverLetter"
                        rows={4}
                        placeholder="Optional cover letter text."
                        defaultValue={initialData?.coverLetter ?? ''}
                    />
                </div>

                {/* Row 10: Notes */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal recruiter notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Row 11: Tags */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                    <ZoruInput
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to candidates
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
