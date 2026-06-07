'use client';

import { useCallback } from 'react';
import {
  LayoutGrid,
  Plus,
  X,
  Image as ImageIcon,
  Type as TypeIcon,
  AlignLeft,
  Zap,
  Link as LinkIcon,
} from 'lucide-react';
import { createId } from '@paralleldrive/cuid2';

import type { Block, ChoiceItem, Variable } from '@/lib/sabflow/types';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Switch,
  SegmentedControl,
  Badge,
  Callout,
  EmptyState,
  IconButton,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ──────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

type SourceMode = 'static' | 'dynamic';

/* ── Helpers ────────────────────────────────────────────────────────────── */

function makePictureChoice(): ChoiceItem {
  return { id: createId(), title: '', content: '', pictureSrc: '', description: '' };
}

function getChoices(block: Block): ChoiceItem[] {
  return (block.items ?? []) as ChoiceItem[];
}

/* ── Toggle row ─────────────────────────────────────────────────────────── */

type ToggleRowProps = {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
};

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-[var(--st-text)]">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} aria-label={label} />
    </div>
  );
}

/* ── Picture choice card ────────────────────────────────────────────────── */

type PictureChoiceCardProps = {
  choice: ChoiceItem;
  index: number;
  onChange: (patch: Partial<ChoiceItem>) => void;
  onDelete: () => void;
};

function PictureChoiceCard({ choice, index, onChange, onDelete }: PictureChoiceCardProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      {/* Card header */}
      <CardHeader className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Card {index + 1}
        </span>
        <IconButton
          label={`Remove card ${index + 1}`}
          icon={X}
          size="sm"
          variant="ghost"
          onClick={onDelete}
        />
      </CardHeader>

      {/* Fields */}
      <CardBody className="space-y-2.5 px-3 py-3">
        {/* Image URL */}
        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Image URL
            </span>
          }
          help="Supports a direct URL or a {{variable}} expression."
        >
          <Input
            type="url"
            inputSize="sm"
            iconLeft={LinkIcon}
            value={choice.pictureSrc ?? ''}
            onChange={(e) => onChange({ pictureSrc: e.target.value })}
            placeholder="https://example.com/image.png or {{imageUrl}}"
          />
        </Field>

        {/* Image preview */}
        {choice.pictureSrc ? (
          <div className="relative h-24 overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={choice.pictureSrc}
              alt={choice.title ?? `Card ${index + 1}`}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : null}

        {/* Title */}
        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              <TypeIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Title
            </span>
          }
        >
          <Input
            type="text"
            inputSize="sm"
            value={choice.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value, content: e.target.value })}
            placeholder={`Option ${index + 1}`}
          />
        </Field>

        {/* Description */}
        <Field
          label={
            <span className="inline-flex w-full items-center gap-1.5">
              <AlignLeft className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Description
              <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-[var(--st-text-tertiary)]">
                optional
              </span>
            </span>
          }
        >
          <Input
            type="text"
            inputSize="sm"
            value={choice.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Short description."
          />
        </Field>
      </CardBody>
    </Card>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function PictureChoiceSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  // Typed option accessors
  const isMultiple = Boolean(options.isMultipleChoice ?? false);
  const buttonLabel = typeof options.buttonLabel === 'string' ? options.buttonLabel : 'Send';
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;

  // Dynamic items (driven by variables, not static cards)
  const dynamicItems = options.dynamicItems as
    | {
        isEnabled?: boolean;
        titlesVariableId?: string;
        descriptionsVariableId?: string;
        pictureSrcsVariableId?: string;
      }
    | undefined;
  const isDynamic = Boolean(dynamicItems?.isEnabled ?? false);
  const sourceMode: SourceMode = isDynamic ? 'dynamic' : 'static';

  const choices = getChoices(block);

  const updateOptions = useCallback(
    (patch: Record<string, unknown>) =>
      onBlockChange({ ...block, options: { ...options, ...patch } }),
    [block, options, onBlockChange],
  );

  const updateDynamicItems = useCallback(
    (patch: Record<string, unknown>) =>
      updateOptions({ dynamicItems: { ...(dynamicItems ?? {}), ...patch } }),
    [dynamicItems, updateOptions],
  );

  const updateItems = useCallback(
    (next: ChoiceItem[]) => onBlockChange({ ...block, items: next }),
    [block, onBlockChange],
  );

  /* ── Card list operations ── */

  const addCard = useCallback(() => {
    updateItems([...choices, makePictureChoice()]);
  }, [choices, updateItems]);

  const deleteCard = useCallback(
    (id: string) => {
      updateItems(choices.filter((c) => c.id !== id));
    },
    [choices, updateItems],
  );

  const updateCard = useCallback(
    (id: string, patch: Partial<ChoiceItem>) => {
      updateItems(choices.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [choices, updateItems],
  );

  /* ── Render ── */

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
          <LayoutGrid className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
          Picture Choice
        </span>
      </div>

      {/* ── Source mode ── */}
      <SegmentedControl<SourceMode>
        aria-label="Card source"
        fullWidth
        size="sm"
        value={sourceMode}
        onChange={(mode) => updateDynamicItems({ isEnabled: mode === 'dynamic' })}
        items={[
          { value: 'static', label: 'Static cards', icon: LayoutGrid },
          { value: 'dynamic', label: 'Dynamic cards', icon: Zap },
        ]}
      />

      {/* ── Static picture cards ── */}
      {!isDynamic && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Cards
            </span>
            {choices.length > 0 ? (
              <Badge tone="neutral" kind="soft">
                {choices.length} card{choices.length !== 1 ? 's' : ''}
              </Badge>
            ) : null}
          </div>

          {choices.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              size="sm"
              title="No cards yet"
              description="Add one below to start your picture choice."
            />
          ) : (
            <div className="space-y-2.5">
              {choices.map((choice, idx) => (
                <PictureChoiceCard
                  key={choice.id}
                  choice={choice}
                  index={idx}
                  onChange={(patch) => updateCard(choice.id, patch)}
                  onDelete={() => deleteCard(choice.id)}
                />
              ))}
            </div>
          )}

          {/* Add card button */}
          <Button variant="outline" size="sm" block iconLeft={Plus} onClick={addCard}>
            Add card
          </Button>
        </div>
      )}

      {/* ── Dynamic items variable pickers ── */}
      {isDynamic && (
        <div className="space-y-3">
          <Callout tone="info" icon={Zap}>
            Each variable should hold a <strong>JSON array of strings</strong> with the same number
            of items.
          </Callout>
          <Field label="Image URLs variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.pictureSrcsVariableId}
              onChange={(id) => updateDynamicItems({ pictureSrcsVariableId: id })}
              placeholder="Select variable"
            />
          </Field>
          <Field label="Titles variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.titlesVariableId}
              onChange={(id) => updateDynamicItems({ titlesVariableId: id })}
              placeholder="Select variable"
            />
          </Field>
          <Field label="Descriptions variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.descriptionsVariableId}
              onChange={(id) => updateDynamicItems({ descriptionsVariableId: id })}
              placeholder="Select variable"
            />
          </Field>
        </div>
      )}

      <div className="h-px bg-[var(--st-border)]" />

      {/* ── Settings section ── */}
      <div className="space-y-4">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Settings
        </p>

        {/* Save answer to variable */}
        <Field label="Save answer to variable">
          <VariableSelect
            variables={variables}
            value={variableId}
            onChange={(id) => updateOptions({ variableId: id })}
          />
        </Field>

        {/* Multiple choice toggle */}
        <ToggleRow
          label="Allow multiple selection"
          description="User can pick more than one card."
          checked={isMultiple}
          onToggle={(next) => updateOptions({ isMultipleChoice: next })}
        />

        {/* Submit button label, only for multi-select */}
        {isMultiple && (
          <Field label="Submit button label">
            <Input
              type="text"
              inputSize="sm"
              value={buttonLabel}
              onChange={(e) => updateOptions({ buttonLabel: e.target.value })}
              placeholder="Send"
            />
          </Field>
        )}
      </div>
    </div>
  );
}
