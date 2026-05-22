'use client';

import {
  Button,
  Card,
  Checkbox,
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
  FileUp,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <TrainingForm /> — create + edit form for HR Training programs.
 *
 * Binds to the `saveTraining` server action via `useActionState`.
 * The `materialsUrl` slot uses `<SabFilePickerButton>` only — SabFiles
 * policy forbids any free-text URL paste for file inputs.
 */

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityMultiFormField } from '@/components/crm/entity-multi-form-field';

import { saveTraining } from '@/app/actions/crm-training.actions';
import type {
    CrmTrainingDoc,
    CrmTrainingStatus,
    CrmTrainingType,
} from '@/lib/rust-client/crm-training';

import {
    BASE,
    DELIVERY_OPTIONS,
    STATUS_OPTIONS,
    TYPE_OPTIONS,
} from '../_config';

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function nameFromUrl(url: string): string {
    if (!url) return '';
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

interface TrainingFormProps {
    initialData?: CrmTrainingDoc | null;
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
            {isEditing ? 'Save changes' : 'Create training'}
        </Button>
    );
}

// Status options for the form: skip the synthetic 'all' entry.
const FORM_STATUS_OPTIONS = STATUS_OPTIONS.filter(
    (o): o is { value: CrmTrainingStatus; label: string } => o.value !== 'all',
);

// Type options for the form: skip 'all'.
const FORM_TYPE_OPTIONS = TYPE_OPTIONS.filter(
    (o): o is { value: CrmTrainingType; label: string } => o.value !== 'all',
);

export function TrainingForm({ initialData }: TrainingFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveTraining, initialState);

    const [materialsUrl, setMaterialsUrl] = useState<string>(
        initialData?.materialsUrl ?? '',
    );
    const [materialsName, setMaterialsName] = useState<string>(() =>
        nameFromUrl(initialData?.materialsUrl ?? ''),
    );

    const [trainingType, setTrainingType] = useState<string>(
        (initialData?.trainingType as string) ?? 'technical',
    );
    const [deliveryMode, setDeliveryMode] = useState<string>(
        (initialData?.deliveryMode as string) ?? 'classroom',
    );
    const [status, setStatus] = useState<CrmTrainingStatus>(
        (initialData?.status as CrmTrainingStatus) ?? 'planned',
    );

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

    const onPickMaterials = (pick: SabFilePick) => {
        setMaterialsUrl(pick.url);
        setMaterialsName(pick.name);
    };

    const clearMaterials = () => {
        setMaterialsUrl('');
        setMaterialsName('');
    };

    const tagsInitial = Array.isArray(initialData?.tags)
        ? (initialData?.tags ?? []).join(', ')
        : '';

    const departmentIdsInitial = Array.isArray(initialData?.departmentIds)
        ? (initialData?.departmentIds ?? []).join(', ')
        : '';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="trainingId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="materialsUrl" value={materialsUrl} />
                {/* TODO 1E.sweep: trainingType + deliveryMode dropdowns are still Select because the local FORM_TYPE_OPTIONS / DELIVERY_OPTIONS slugs in _config.ts don't map 1:1 to the catalogued `trainingDeliveryMode` enum. Bridge slugs or extend the catalogue, then swap to <EnumFormField>. */}
                <input type="hidden" name="trainingType" value={trainingType} />
                <input type="hidden" name="deliveryMode" value={deliveryMode} />

                {/* Row 1: Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="e.g. New Hire Onboarding — May 2026"
                        defaultValue={initialData?.name ?? ''}
                    />
                </div>

                {/* Row 2: Type + Delivery mode */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="trainingType-trigger">Type</Label>
                        <Select value={trainingType} onValueChange={setTrainingType}>
                            <ZoruSelectTrigger id="trainingType-trigger">
                                <ZoruSelectValue placeholder="Pick a type…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {FORM_TYPE_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="deliveryMode-trigger">Delivery</Label>
                        <Select value={deliveryMode} onValueChange={setDeliveryMode}>
                            <ZoruSelectTrigger id="deliveryMode-trigger">
                                <ZoruSelectValue placeholder="Pick a mode…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {DELIVERY_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 3: Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        placeholder="Course outline, objectives, audience…"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Row 4: Trainer (entity picker dual-writes trainerName) + Provider */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Trainer</Label>
                        <EntityFormField
                            entity="employee"
                            name="trainerId"
                            dualWriteName="trainerName"
                            initialId={initialData?.trainerId ?? null}
                            initialLabel={initialData?.trainerName ?? ''}
                            allowCreate
                            placeholder="Select trainer"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="provider">Provider</Label>
                        <Input
                            id="provider"
                            name="provider"
                            placeholder="e.g. Coursera, Internal"
                            defaultValue={initialData?.provider ?? ''}
                        />
                    </div>
                </div>

                {/* Row 5: Dates + Duration */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start date</Label>
                        <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.startDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endDate">End date</Label>
                        <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.endDate)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="durationHours">Duration (hours)</Label>
                        <Input
                            id="durationHours"
                            name="durationHours"
                            type="number"
                            min={0}
                            step="0.5"
                            defaultValue={initialData?.durationHours ?? ''}
                        />
                    </div>
                </div>

                {/* Row 6: Location + Max participants */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            name="location"
                            placeholder="Room / city / virtual link"
                            defaultValue={initialData?.location ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="maxParticipants">Max participants</Label>
                        <Input
                            id="maxParticipants"
                            name="maxParticipants"
                            type="number"
                            min={0}
                            defaultValue={initialData?.maxParticipants ?? ''}
                        />
                    </div>
                </div>

                {/* Row 7: Cost + Currency */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="costPerPerson">Cost per person</Label>
                        <Input
                            id="costPerPerson"
                            name="costPerPerson"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={initialData?.costPerPerson ?? ''}
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

                {/* Row 8: Materials (SabFile) */}
                <div className="space-y-1.5">
                    <Label>Materials</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={onPickMaterials}
                            title="Pick training materials"
                        >
                            <FileUp className="mr-1.5 h-4 w-4" />
                            {materialsUrl ? 'Replace materials' : 'Choose from SabFiles'}
                        </SabFilePickerButton>
                        {materialsUrl ? (
                            <>
                                <a
                                    href={materialsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="max-w-[260px] truncate text-[12.5px] text-zoru-ink underline-offset-2 hover:underline"
                                >
                                    {materialsName || materialsUrl}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearMaterials}
                                >
                                    Remove
                                </Button>
                            </>
                        ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                                No materials attached.
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 9: Tags + Department ids */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                            id="tags"
                            name="tags"
                            placeholder="comma, separated, tags"
                            defaultValue={tagsInitial}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Departments</Label>
                        <EntityMultiFormField
                            entity="department"
                            name="departmentIds"
                            initialIds={
                                Array.isArray(initialData?.departmentIds)
                                    ? (initialData?.departmentIds as string[])
                                    : []
                            }
                            allowCreate
                            placeholder="Add departments"
                        />
                    </div>
                </div>

                {/* Row 10: Flags + Status */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="isMandatory"
                            name="isMandatory"
                            defaultChecked={!!initialData?.isMandatory}
                        />
                        <Label htmlFor="isMandatory" className="cursor-pointer">
                            Mandatory
                        </Label>
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <Checkbox
                            id="certificationProvided"
                            name="certificationProvided"
                            defaultChecked={!!initialData?.certificationProvided}
                        />
                        <Label htmlFor="certificationProvided" className="cursor-pointer">
                            Certification provided
                        </Label>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        {/* TODO 1E.sweep: trainingStatus catalogue uses 'planned' slug; training crate uses 'planned' too — verify before locking inline-create off. */}
                        <EnumFormField
                            enumName="trainingStatus"
                            name="status"
                            initialId={status}
                            onChange={(id) =>
                                setStatus(
                                    (id as CrmTrainingStatus) ?? 'planned',
                                )
                            }
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Row 11: Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes (not shown to participants)"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to training
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
