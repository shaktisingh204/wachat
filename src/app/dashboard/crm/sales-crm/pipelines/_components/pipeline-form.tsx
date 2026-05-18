'use client';

import { ZoruButton, ZoruCard, ZoruCheckbox, ZoruInput, ZoruLabel, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <PipelineForm /> — create + edit form for CRM Sales Pipelines.
 *
 * Binds to the `savePipeline` server action via `useActionState`.
 *
 * Stages are a structured repeater of
 * `{ name, color, order, probability, conditions }` rows serialised to a
 * hidden JSON-array input that `parseStagesJson` on the server side
 * decodes. The Rust backend persists name/color/order/chance; UI-only
 * fields (`conditions`, `description`, `entityKind`, `status`) round-trip
 * through the legacy embedded path and are best-effort surfaced on the
 * Rust path.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    savePipeline,
    type PipelineUiDoc,
    type PipelineUiStage,
} from '@/app/actions/crm-pipelines.actions';

const BASE = '/dashboard/crm/sales-crm/pipelines';

const DEFAULT_STAGES: PipelineUiStage[] = [
    { name: 'New', order: 0, probability: 10 },
    { name: 'Qualified', order: 1, probability: 30 },
    { name: 'Proposal', order: 2, probability: 60 },
    { name: 'Negotiation', order: 3, probability: 80 },
    { name: 'Won', order: 4, probability: 100 },
    { name: 'Lost', order: 5, probability: 0 },
];

interface PipelineFormProps {
    initialData?: PipelineUiDoc | null;
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
            {isEditing ? 'Save changes' : 'Create pipeline'}
        </ZoruButton>
    );
}

export function PipelineForm({ initialData }: PipelineFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePipeline, initialState);

    const [entityKind, setEntityKind] = useState<'lead' | 'deal' | 'opportunity'>(
        initialData?.entityKind ?? 'lead',
    );
    const [status, setStatus] = useState<'active' | 'archived' | 'draft'>(
        initialData?.status ?? 'active',
    );
    const [isDefault, setIsDefault] = useState<boolean>(!!initialData?.isDefault);
    const [stages, setStages] = useState<PipelineUiStage[]>(() => {
        if (initialData?.stages?.length) return initialData.stages;
        return DEFAULT_STAGES;
    });

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

    const addStage = () =>
        setStages((prev) => [
            ...prev,
            {
                name: 'New Stage',
                order: prev.length,
                probability: 0,
            },
        ]);

    const removeStage = (idx: number) =>
        setStages((prev) =>
            prev
                .filter((_, i) => i !== idx)
                .map((s, i) => ({ ...s, order: i })),
        );

    const updateStage = <K extends keyof PipelineUiStage>(
        idx: number,
        key: K,
        value: PipelineUiStage[K],
    ) =>
        setStages((prev) =>
            prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
        );

    const moveStage = (idx: number, dir: -1 | 1) => {
        setStages((prev) => {
            const j = idx + dir;
            if (j < 0 || j >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[j]] = [copy[j], copy[idx]];
            return copy.map((s, i) => ({ ...s, order: i }));
        });
    };

    const stagesJson = JSON.stringify(
        stages.map((s, i) => ({
            _id: s._id,
            id: s.id,
            name: s.name?.trim() ?? '',
            color: s.color?.trim() || undefined,
            order: i,
            probability:
                typeof s.probability === 'number' && Number.isFinite(s.probability)
                    ? s.probability
                    : 0,
            conditions: s.conditions?.trim() || undefined,
        })),
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="pipelineId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="entityKind" value={entityKind} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="isDefault" value={isDefault ? 'on' : 'off'} />
                <input type="hidden" name="stages" value={stagesJson} />

                {/* Name */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Pipeline name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Enterprise Sales"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="color">Accent color</ZoruLabel>
                        <ZoruInput
                            id="color"
                            name="color"
                            placeholder="#3B82F6"
                            defaultValue={initialData?.color ?? ''}
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={2}
                        placeholder="What is this pipeline for?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Entity kind + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Applies to</ZoruLabel>
                        <EnumFormField
                            enumName="pipelineEntityKind"
                            name="entityKindPicker"
                            initialId={entityKind}
                            allowInlineCreate={false}
                            placeholder="Entity kind"
                            onChange={(v) =>
                                setEntityKind(
                                    (v ?? 'lead') as 'lead' | 'deal' | 'opportunity',
                                )
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="activeDraftArchived"
                            name="statusPicker"
                            initialId={status}
                            placeholder="Status"
                            onChange={(v) =>
                                setStatus(
                                    (v ?? 'active') as 'active' | 'archived' | 'draft',
                                )
                            }
                        />
                    </div>
                </div>

                {/* Default flag */}
                <div className="flex items-center gap-2">
                    <ZoruCheckbox
                        id="isDefault"
                        checked={isDefault}
                        onCheckedChange={(v) => setIsDefault(!!v)}
                    />
                    <ZoruLabel htmlFor="isDefault" className="cursor-pointer">
                        Make this the default pipeline
                    </ZoruLabel>
                </div>

                {/* Stages repeater */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Stages *</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addStage}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add stage
                        </ZoruButton>
                    </div>
                    {stages.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            At least one stage is required.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {stages.map((s, idx) => (
                                <div
                                    key={s._id || s.id || `new-${idx}`}
                                    className="grid grid-cols-1 gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[auto_1fr_120px_120px_2fr_auto]"
                                >
                                    <div className="flex flex-col items-center justify-center gap-1 self-center">
                                        <button
                                            type="button"
                                            onClick={() => moveStage(idx, -1)}
                                            disabled={idx === 0}
                                            className="text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30"
                                            aria-label="Move up"
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </button>
                                        <span className="font-mono text-[10px] text-zoru-ink-muted">
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <ZoruInput
                                        placeholder="Stage name"
                                        value={s.name}
                                        onChange={(e) =>
                                            updateStage(idx, 'name', e.target.value)
                                        }
                                    />
                                    <ZoruInput
                                        type="number"
                                        placeholder="Probability %"
                                        min={0}
                                        max={100}
                                        value={
                                            typeof s.probability === 'number'
                                                ? s.probability
                                                : ''
                                        }
                                        onChange={(e) =>
                                            updateStage(
                                                idx,
                                                'probability',
                                                e.target.value === ''
                                                    ? undefined
                                                    : Number(e.target.value),
                                            )
                                        }
                                    />
                                    <ZoruInput
                                        placeholder="Color (e.g. #3B82F6)"
                                        value={s.color ?? ''}
                                        onChange={(e) =>
                                            updateStage(idx, 'color', e.target.value)
                                        }
                                    />
                                    <ZoruInput
                                        placeholder="Conditions / routing rule"
                                        value={s.conditions ?? ''}
                                        onChange={(e) =>
                                            updateStage(idx, 'conditions', e.target.value)
                                        }
                                    />
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeStage(idx)}
                                        aria-label="Remove stage"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to pipelines
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
