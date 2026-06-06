'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
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
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create candidate'}
        </Button>
    );
}

export function CandidateForm({ initialData }: CandidateFormProps) {
    const router = useRouter();
    const { toast } = useToast();
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
        <Card className="p-6">
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
                        <Label htmlFor="firstName">First name *</Label>
                        <Input
                            id="firstName"
                            name="firstName"
                            required
                            placeholder="e.g. Priya"
                            defaultValue={initialData?.firstName ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
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
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            required
                            placeholder="name@example.com"
                            defaultValue={initialData?.email ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
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
                        <Label htmlFor="currentCompany">
                            Current company
                        </Label>
                        <Input
                            id="currentCompany"
                            name="currentCompany"
                            placeholder="e.g. Acme Corp"
                            defaultValue={initialData?.currentCompany ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currentTitle">
                            Current title
                        </Label>
                        <Input
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
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="e.g. Bengaluru, IN"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="jobId">Linked job id</Label>
                        <Input
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
                        <Label>Stage</Label>
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
                        <Label>Source</Label>
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
                    <Label>Resume</Label>
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
                                    className="max-w-[260px] truncate text-[12.5px] text-[var(--st-text)] underline-offset-2 hover:underline"
                                >
                                    {resumeName || resumeUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearResume}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                No resume attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 7: Experience + expected salary + currency */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="experienceYears">
                            Experience (yrs)
                        </Label>
                        <Input
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
                        <Label htmlFor="expectedSalary">
                            Expected salary
                        </Label>
                        <Input
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

                {/* Row 8: Skills + Rating */}
                <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1.5">
                        <Label htmlFor="skills">Skills</Label>
                        <Input
                            id="skills"
                            name="skills"
                            placeholder="react, typescript, node"
                            defaultValue={skillsInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="rating">Rating (1-5)</Label>
                        <Input
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
                    <Label htmlFor="coverLetter">Cover letter</Label>
                    <Textarea
                        id="coverLetter"
                        name="coverLetter"
                        rows={4}
                        placeholder="Optional cover letter text."
                        defaultValue={initialData?.coverLetter ?? ''}
                    />
                </div>

                {/* Row 10: Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal recruiter notes."
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Row 11: Tags */}
                <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                        id="tags"
                        name="tags"
                        placeholder="comma, separated, tags"
                        defaultValue={tagsInitial}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to candidates
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
