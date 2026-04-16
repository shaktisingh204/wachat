'use client';

import { useCallback } from 'react';
import {
  LuLayoutGrid,
  LuPlus,
  LuX,
  LuImage,
  LuType,
  LuAlignLeft,
  LuZap,
} from 'react-icons/lu';
import { createId } from '@paralleldrive/cuid2';
import type { Block, ChoiceItem, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import {
  Field,
  PanelHeader,
  Divider,
  inputClass,
  toggleClass,
} from './shared/primitives';

/* ── Types ──────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

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
  onToggle: () => void;
};

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-[var(--gray-11)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--gray-8)] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={toggleClass(checked)}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
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
    <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] overflow-hidden transition-colors hover:border-[var(--gray-6)]">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--gray-4)] bg-[var(--gray-1)]">
        <span className="text-[11px] font-semibold text-[var(--gray-8)] uppercase tracking-wide">
          Card {index + 1}
        </span>
        <button
          type="button"
          onClick={onDelete}
          title="Remove card"
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-7)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LuX className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>

      {/* Fields */}
      <div className="px-3 py-3 space-y-2.5">
        {/* Image URL */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)]">
            <LuImage className="h-3 w-3" strokeWidth={2} />
            Image URL
          </label>
          <input
            type="text"
            value={choice.pictureSrc ?? ''}
            onChange={(e) => onChange({ pictureSrc: e.target.value })}
            placeholder="https://example.com/image.png or {{variable}}"
            className={inputClass}
          />
        </div>

        {/* Image preview */}
        {choice.pictureSrc && (
          <div className="relative rounded-md overflow-hidden bg-[var(--gray-3)] border border-[var(--gray-4)] h-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={choice.pictureSrc}
              alt={choice.title ?? `Card ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)]">
            <LuType className="h-3 w-3" strokeWidth={2} />
            Title
          </label>
          <input
            type="text"
            value={choice.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value, content: e.target.value })}
            placeholder={`Option ${index + 1}`}
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--gray-9)]">
            <LuAlignLeft className="h-3 w-3" strokeWidth={2} />
            Description
            <span className="ml-auto text-[10px] text-[var(--gray-7)] font-normal normal-case tracking-normal">
              optional
            </span>
          </label>
          <input
            type="text"
            value={choice.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Short description…"
            className={inputClass}
          />
        </div>
      </div>
    </div>
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
      <PanelHeader icon={LuLayoutGrid} title="Picture Choice" />

      {/* ── Dynamic items toggle ── */}
      <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)] overflow-hidden">
        <button
          type="button"
          onClick={() => updateDynamicItems({ isEnabled: false })}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
            !isDynamic
              ? 'bg-[#f7680812] text-[#f76808]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)]'
          }`}
        >
          <LuLayoutGrid className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="text-[12px] font-medium">Static cards</span>
        </button>
        <button
          type="button"
          onClick={() => updateDynamicItems({ isEnabled: true })}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
            isDynamic
              ? 'bg-[#f7680812] text-[#f76808]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)]'
          }`}
        >
          <LuZap className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="text-[12px] font-medium">Dynamic cards</span>
        </button>
      </div>

      {/* ── Static picture cards ── */}
      {!isDynamic && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
              Cards
            </label>
            {choices.length > 0 && (
              <span className="text-[11px] text-[var(--gray-7)]">
                {choices.length} card{choices.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {choices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] py-6 text-center">
              <LuLayoutGrid
                className="mx-auto h-5 w-5 text-[var(--gray-6)] mb-1.5"
                strokeWidth={1.5}
              />
              <p className="text-[11.5px] text-[var(--gray-8)]">No cards yet — add one below</p>
            </div>
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
          <button
            type="button"
            onClick={addCard}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-5)] py-2 text-[12px] font-medium text-[var(--gray-8)] hover:border-[#f76808] hover:text-[#f76808] hover:bg-[#f7680808] transition-colors"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add card
          </button>
        </div>
      )}

      {/* ── Dynamic items variable pickers ── */}
      {isDynamic && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2.5 flex items-start gap-2">
            <LuZap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#f76808]" strokeWidth={2} />
            <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
              Each variable should hold a <strong>JSON array of strings</strong> with the same
              number of items.
            </p>
          </div>
          <Field label="Image URLs variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.pictureSrcsVariableId}
              onChange={(id) => updateDynamicItems({ pictureSrcsVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>
          <Field label="Titles variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.titlesVariableId}
              onChange={(id) => updateDynamicItems({ titlesVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>
          <Field label="Descriptions variable">
            <VariableSelect
              variables={variables}
              value={dynamicItems?.descriptionsVariableId}
              onChange={(id) => updateDynamicItems({ descriptionsVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>
        </div>
      )}

      <Divider />

      {/* ── Settings section ── */}
      <div className="space-y-4">
        <p className="text-[11.5px] font-semibold text-[var(--gray-9)] uppercase tracking-wide">
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium text-[var(--gray-11)]">Allow multiple selection</p>
            <p className="text-[11px] text-[var(--gray-8)] mt-0.5 leading-relaxed">
              User can pick more than one card
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isMultiple}
            onClick={() => updateOptions({ isMultipleChoice: !isMultiple })}
            className={toggleClass(isMultiple)}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                isMultiple ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Submit button label — only for multi-select */}
        {isMultiple && (
          <Field label="Submit button label">
            <input
              type="text"
              value={buttonLabel}
              onChange={(e) => updateOptions({ buttonLabel: e.target.value })}
              placeholder="Send"
              className={inputClass}
            />
          </Field>
        )}
      </div>
    </div>
  );
}
