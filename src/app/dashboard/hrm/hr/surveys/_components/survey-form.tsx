'use client';

import { Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

// §1E.sweep: status Select kept — wire value 'active' differs from surveyStatus enum 'open'; resolve Rust DTO then swap.
// §1E.sweep: type/audience ZoruSelects kept — no matching catalogue enums (surveyType/surveyAudience not in CRM_ENUMS).

/**
 * <SurveyForm /> — shared create/edit form for HR Surveys.
 *
 * Wraps `saveSurvey` from `crm-surveys.actions.ts` with `useActionState` +
 * `useFormStatus`. When `initialData` is supplied the form acts as an
 * edit form (a hidden `surveyId` input is rendered and the action takes
 * the update branch).
 *
 * Questions are managed by <QuestionRepeater /> — a structured editor
 * that posts a JSON payload to the `questions` field. There is NO
 * free-text JSON paste anywhere in this form.
 */

import * as React from 'react';

import {
    saveSurvey,
    type CrmSurveyAudience,
    type CrmSurveyDoc,
    type CrmSurveyStatus,
    type CrmSurveyType,
} from '@/app/actions/crm-surveys.actions';

import { QuestionRepeater, type SurveyQuestion } from './question-repeater';

const BASE = '/dashboard/hrm/hr/surveys';

const TYPE_OPTIONS: Array<{ value: CrmSurveyType; label: string }> = [
    { value: 'engagement', label: 'Engagement' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'exit', label: 'Exit' },
    { value: 'custom', label: 'Custom' },
];

const AUDIENCE_OPTIONS: Array<{ value: CrmSurveyAudience; label: string }> = [
    { value: 'all', label: 'All employees' },
    { value: 'department', label: 'Department' },
    { value: 'team', label: 'Team' },
    { value: 'role', label: 'Role' },
];

const STATUS_OPTIONS: Array<{ value: CrmSurveyStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

function toLocalInput(v?: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}`;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create survey'}
        </Button>
    );
}

export interface SurveyFormProps {
    initialData?: CrmSurveyDoc | null;
}

export function SurveyForm({ initialData }: SurveyFormProps) {
    const isEditing = !!initialData?._id;
    const router = useRouter();
    const { toast } = useToast();

    const [state, formAction] = useActionState(saveSurvey, initialState);

    const [type, setType] = React.useState<CrmSurveyType>(
        (initialData?.type as CrmSurveyType) ?? 'engagement',
    );
    const [audience, setAudience] = React.useState<CrmSurveyAudience>(
        (initialData?.targetAudience as CrmSurveyAudience) ?? 'all',
    );
    const [status, setStatus] = React.useState<CrmSurveyStatus>(
        (initialData?.status as CrmSurveyStatus) ?? 'draft',
    );

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
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
    }, [state, toast, router, initialData?._id]);

    const audienceIdsInitial = Array.isArray(initialData?.audienceIds)
        ? (initialData?.audienceIds ?? []).join(', ')
        : '';

    const audienceNeedsIds = audience !== 'all';

    const initialQuestions = React.useMemo<SurveyQuestion[]>(() => {
        if (!Array.isArray(initialData?.questions)) return [];
        return initialData!.questions!.map((q) => ({
            label: q.label,
            type: q.type,
            required: q.required,
            options: q.options,
        }));
    }, [initialData]);

    return (
        <form action={formAction} className="flex flex-col gap-6">
            {isEditing ? (
                <input
                    type="hidden"
                    name="surveyId"
                    value={String(initialData!._id)}
                />
            ) : null}
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="targetAudience" value={audience} />
            <input type="hidden" name="status" value={status} />

            {/* Basics */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Survey
                </div>
                <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            name="title"
                            required
                            placeholder="e.g. Q2 Engagement Survey"
                            defaultValue={initialData?.title ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            rows={4}
                            placeholder="What is this survey about and why are you running it?"
                            defaultValue={initialData?.description ?? ''}
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="type-trigger">Type</Label>
                            <Select
                                value={type}
                                onValueChange={(v) =>
                                    setType(v as CrmSurveyType)
                                }
                            >
                                <SelectTrigger id="type-trigger">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="status-trigger">Status</Label>
                            <Select
                                value={status}
                                onValueChange={(v) =>
                                    setStatus(v as CrmSurveyStatus)
                                }
                            >
                                <SelectTrigger id="status-trigger">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Audience */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Audience
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="audience-trigger">
                            Target audience
                        </Label>
                        <Select
                            value={audience}
                            onValueChange={(v) =>
                                setAudience(v as CrmSurveyAudience)
                            }
                        >
                            <SelectTrigger id="audience-trigger">
                                <SelectValue placeholder="Audience" />
                            </SelectTrigger>
                            <SelectContent>
                                {AUDIENCE_OPTIONS.map((o) => (
                                    <SelectItem
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {audienceNeedsIds ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="audienceIds">
                                {audience === 'department'
                                    ? 'Department IDs'
                                    : audience === 'team'
                                      ? 'Team IDs'
                                      : 'Role IDs'}
                            </Label>
                            <Input
                                id="audienceIds"
                                name="audienceIds"
                                placeholder="comma, separated, ids"
                                defaultValue={audienceIdsInitial}
                            />
                        </div>
                    ) : null}
                </div>
                <label className="mt-4 flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                    <Checkbox
                        id="anonymous"
                        name="anonymous"
                        defaultChecked={!!initialData?.anonymous}
                    />
                    Collect responses anonymously
                </label>
            </Card>

            {/* Schedule */}
            <Card className="p-6">
                <div className="mb-4 text-[14px] font-medium text-[var(--st-text)]">
                    Schedule
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="startsAt">Starts at</Label>
                        <Input
                            id="startsAt"
                            name="startsAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.startsAt)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endsAt">Ends at</Label>
                        <Input
                            id="endsAt"
                            name="endsAt"
                            type="datetime-local"
                            defaultValue={toLocalInput(initialData?.endsAt)}
                        />
                    </div>
                </div>
            </Card>

            {/* Questions */}
            <Card className="p-6">
                <div className="mb-1 text-[14px] font-medium text-[var(--st-text)]">
                    Questions
                </div>
                <p className="mb-4 text-[12px] text-[var(--st-text-secondary)]">
                    Build your survey one question at a time. Reorder with the
                    arrows; choice questions show an inline option editor.
                </p>
                <QuestionRepeater initial={initialQuestions} />
            </Card>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" asChild>
                    <Link
                        href={
                            isEditing && initialData?._id
                                ? `${BASE}/${initialData._id}`
                                : BASE
                        }
                    >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Cancel
                    </Link>
                </Button>
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
