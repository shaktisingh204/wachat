'use client';

/**
 * <PipelineForm /> create + edit form for CRM Sales Pipelines.
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

import {
  Button,
  Card,
  Checkbox,
  ColorPicker,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
  ArrowLeft,
  ChevronUp,
  Layers,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
  savePipeline,
  type PipelineUiDoc,
  type PipelineUiStage,
} from '@/app/actions/crm-pipelines.actions';

const BASE = '/dashboard/sabbigin/pipelines';

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
    <Button
      type="submit"
      variant="primary"
      loading={pending}
      iconLeft={Save}
    >
      {isEditing ? 'Save changes' : 'Create pipeline'}
    </Button>
  );
}

export function PipelineForm({ initialData }: PipelineFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(savePipeline, initialState);

  const [entityKind, setEntityKind] = useState<'lead' | 'deal' | 'opportunity'>(
    initialData?.entityKind ?? 'lead',
  );
  const [status, setStatus] = useState<'active' | 'archived' | 'draft'>(
    initialData?.status ?? 'active',
  );
  const [isDefault, setIsDefault] = useState<boolean>(!!initialData?.isDefault);
  const [accentColor, setAccentColor] = useState<string>(initialData?.color ?? '#3B82F6');
  const [stages, setStages] = useState<PipelineUiStage[]>(() => {
    if (initialData?.stages?.length) return initialData.stages;
    return DEFAULT_STAGES;
  });

  useEffect(() => {
    if (state?.message) {
      toast.success({ title: 'Saved', description: state.message });
      const id = state.id ?? initialData?._id;
      if (id) router.push(`${BASE}/${id}`);
      else router.push(BASE);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
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
    <Card padding="lg">
      <form action={formAction} className="flex flex-col gap-6">
        {isEditing ? (
          <input type="hidden" name="pipelineId" value={initialData!._id} />
        ) : null}
        <input type="hidden" name="entityKind" value={entityKind} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="isDefault" value={isDefault ? 'on' : 'off'} />
        <input type="hidden" name="stages" value={stagesJson} />

        {/* Name + accent */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pipeline name" required>
            <Input
              name="name"
              required
              placeholder="e.g. Enterprise Sales"
              defaultValue={initialData?.name ?? ''}
            />
          </Field>
          <Field label="Accent color">
            <input type="hidden" name="color" value={accentColor} />
            <ColorPicker value={accentColor} onChange={setAccentColor} />
          </Field>
        </div>

        {/* Description */}
        <Field label="Description">
          <Textarea
            name="description"
            rows={2}
            placeholder="What is this pipeline for?"
            defaultValue={initialData?.description ?? ''}
          />
        </Field>

        {/* Entity kind + Status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Applies to">
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
          </Field>
          <Field label="Status">
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
          </Field>
        </div>

        {/* Default flag */}
        <Checkbox
          name="isDefaultToggle"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          label="Make this the default pipeline"
        />

        {/* Stages repeater */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label required>Stages</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconLeft={Plus}
              onClick={addStage}
            >
              Add stage
            </Button>
          </div>
          {stages.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Layers}
              title="No stages yet"
              description="At least one stage is required."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Plus}
                  onClick={addStage}
                >
                  Add stage
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {stages.map((s, idx) => (
                <div
                  key={s._id || s.id || `new-${idx}`}
                  className="grid grid-cols-1 gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 sm:grid-cols-[auto_1fr_120px_120px_2fr_auto]"
                >
                  <div className="flex flex-col items-center justify-center gap-1 self-center">
                    <IconButton
                      label="Move stage up"
                      icon={ChevronUp}
                      size="sm"
                      onClick={() => moveStage(idx, -1)}
                      disabled={idx === 0}
                    />
                    <span className="font-mono text-[10px] text-[var(--st-text-secondary)]">
                      {idx + 1}
                    </span>
                  </div>
                  <Field label="Stage name">
                    <Input
                      placeholder="Stage name"
                      value={s.name}
                      onChange={(e) =>
                        updateStage(idx, 'name', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Probability %">
                    <Input
                      type="number"
                      placeholder="0-100"
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
                  </Field>
                  <Field label="Color">
                    <Input
                      placeholder="#3B82F6"
                      value={s.color ?? ''}
                      onChange={(e) =>
                        updateStage(idx, 'color', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Conditions">
                    <Input
                      placeholder="Conditions / routing rule"
                      value={s.conditions ?? ''}
                      onChange={(e) =>
                        updateStage(idx, 'conditions', e.target.value)
                      }
                    />
                  </Field>
                  <div className="flex items-end">
                    <IconButton
                      label="Remove stage"
                      icon={Trash2}
                      variant="danger"
                      onClick={() => removeStage(idx)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            iconLeft={ArrowLeft}
            onClick={() => router.push(BASE)}
          >
            Back to pipelines
          </Button>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </Card>
  );
}
