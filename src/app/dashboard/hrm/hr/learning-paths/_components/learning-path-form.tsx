'use client';

import { Badge, Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  BookOpen,
  LoaderCircle,
  Plus,
  Save,
  X,
  } from 'lucide-react';

// §1E status:
// - status ZoruSelect:   TODO §1E: add enumName for learningPathStatus (CrmLearningPathStatus not in CRM_ENUMS catalogue yet)
// - audience ZoruSelect: TODO §1E: add enumName for learningPathAudience (CrmLearningPathAudience not in CRM_ENUMS catalogue yet)

/**
 * <LearningPathForm /> — create + edit form for HR Learning paths.
 *
 * Binds to the `saveLearningPath` server action via `useActionState`.
 *
 * Trainings are picked from the live training list (fetched on mount via
 * `getTrainings`) and submitted as multiple hidden `trainings` inputs;
 * the server action reads them with `formData.getAll('trainings')`.
 */

import * as React from 'react';

import {
    saveLearningPath,
    type CrmLearningPathAudience,
    type CrmLearningPathDoc,
    type CrmLearningPathStatus,
} from '@/app/actions/crm-learning-paths.actions';
import { getTrainings } from '@/app/actions/crm-training.actions';
import type { CrmTrainingDoc } from '@/lib/rust-client/crm-training';

import { AUDIENCE_OPTIONS, BASE, STATUS_OPTIONS } from '../_config';

interface LearningPathFormProps {
    initialData?: CrmLearningPathDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

// Strip the synthetic 'all' status entry; the form picks a concrete status.
const FORM_STATUS_OPTIONS = STATUS_OPTIONS.filter(
    (o): o is { value: CrmLearningPathStatus; label: string } =>
        o.value !== 'all',
);

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create learning path'}
        </Button>
    );
}

export function LearningPathForm({ initialData }: LearningPathFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveLearningPath, initialState);

    const [status, setStatus] = useState<CrmLearningPathStatus>(
        initialData?.status ?? 'draft',
    );
    const [audience, setAudience] = useState<CrmLearningPathAudience>(
        initialData?.targetAudience ?? 'all',
    );

    // Selected training ids (string[]). Pre-seeded from initialData.
    const [selectedTrainings, setSelectedTrainings] = useState<string[]>(() =>
        Array.isArray(initialData?.trainings) ? initialData!.trainings : [],
    );
    // Picker dropdown value (single select that appends to the array).
    const [pickerValue, setPickerValue] = useState<string>('');

    // Live training catalogue for the picker + chip labels.
    const [allTrainings, setAllTrainings] = useState<CrmTrainingDoc[]>([]);
    const [loadingTrainings, setLoadingTrainings] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await getTrainings({ limit: 200 });
                if (active) setAllTrainings(res.items ?? []);
            } catch {
                if (active) setAllTrainings([]);
            } finally {
                if (active) setLoadingTrainings(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const trainingName = React.useCallback(
        (id: string): string => {
            const found = allTrainings.find((t) => t._id === id);
            return found?.name ?? id;
        },
        [allTrainings],
    );

    const addTraining = () => {
        if (!pickerValue) return;
        setSelectedTrainings((curr) =>
            curr.includes(pickerValue) ? curr : [...curr, pickerValue],
        );
        setPickerValue('');
    };

    const removeTraining = (id: string) => {
        setSelectedTrainings((curr) => curr.filter((x) => x !== id));
    };

    // The picker should not show already-selected trainings.
    const availableForPicker = allTrainings.filter(
        (t) => !selectedTrainings.includes(t._id),
    );

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="learningPathId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="targetAudience" value={audience} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. Frontend Engineering Track"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Outline what this learning path covers and who it is for."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 3: Audience + Duration */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="audience-trigger">Target audience</Label>
                        <Select
                            value={audience}
                            onValueChange={(v) =>
                                setAudience(v as CrmLearningPathAudience)
                            }
                        >
                            <SelectTrigger id="audience-trigger">
                                <SelectValue placeholder="Pick an audience…" />
                            </SelectTrigger>
                            <SelectContent>
                                {AUDIENCE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="durationWeeks">Duration (weeks)</Label>
                        <Input
                            id="durationWeeks"
                            name="durationWeeks"
                            type="number"
                            min={0}
                            defaultValue={initialData?.durationWeeks ?? ''}
                        />
                    </div>
                </div>

                {/* Row 4: Trainings multi-pick */}
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                        <Label>Trainings</Label>
                        <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                            {selectedTrainings.length} selected
                        </span>
                    </div>

                    {/* Hidden inputs — the server reads `formData.getAll('trainings')`. */}
                    {selectedTrainings.map((id) => (
                        <input
                            key={`hidden-${id}`}
                            type="hidden"
                            name="trainings"
                            value={id}
                        />
                    ))}

                    {/* Picker — single Select + Add button. */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={pickerValue} onValueChange={setPickerValue}>
                            <SelectTrigger className="min-w-[260px] flex-1">
                                <SelectValue
                                    placeholder={
                                        loadingTrainings
                                            ? 'Loading trainings…'
                                            : availableForPicker.length === 0
                                              ? 'No more trainings to add'
                                              : 'Pick a training to add…'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {availableForPicker.map((t) => (
                                    <SelectItem key={t._id} value={t._id}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addTraining}
                            disabled={!pickerValue}
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add
                        </Button>
                    </div>

                    {/* Chips list */}
                    {selectedTrainings.length === 0 ? (
                        <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                            No trainings selected yet.
                        </div>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {selectedTrainings.map((id) => (
                                <li key={id}>
                                    <Badge
                                        variant="ghost"
                                        className="flex items-center gap-1.5 pr-1"
                                    >
                                        <BookOpen className="h-3 w-3" />
                                        <span className="max-w-[220px] truncate">
                                            {trainingName(id)}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${trainingName(id)}`}
                                            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--st-bg-secondary)]"
                                            onClick={() => removeTraining(id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Row 5: Mandatory + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="isMandatory"
                            name="isMandatory"
                            defaultChecked={!!initialData?.isMandatory}
                        />
                        <Label htmlFor="isMandatory" className="cursor-pointer">
                            Mandatory for the target audience
                        </Label>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="status-trigger">Status</Label>
                        <Select
                            value={status}
                            onValueChange={(v) =>
                                setStatus(v as CrmLearningPathStatus)
                            }
                        >
                            <SelectTrigger id="status-trigger">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {FORM_STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to learning paths
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
