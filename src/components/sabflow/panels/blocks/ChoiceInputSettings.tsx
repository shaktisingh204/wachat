'use client';

import { useState, useCallback, useId } from 'react';
import {
  LuListChecks,
  LuPlus,
  LuX,
  LuChevronUp,
  LuChevronDown,
  LuZap,
  LuSearch,
  LuAlignLeft,
  LuChevronRight,
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

function makeChoice(): ChoiceItem {
  return { id: createId(), content: '', value: '' };
}

function getChoices(block: Block): ChoiceItem[] {
  const items = block.items ?? [];
  return items as ChoiceItem[];
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

/* ── Choice row ─────────────────────────────────────────────────────────── */

type ChoiceRowProps = {
  choice: ChoiceItem;
  index: number;
  total: number;
  showValue: boolean;
  onToggleValue: () => void;
  onChange: (patch: Partial<ChoiceItem>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

function ChoiceRow({
  choice,
  index,
  total,
  showValue,
  onToggleValue,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ChoiceRowProps) {
  const labelId = useId();

  return (
    <div className="group rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] overflow-hidden transition-colors hover:border-[var(--gray-6)]">
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Reorder buttons */}
        <div className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--gray-7)] hover:text-[var(--gray-11)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <LuChevronUp className="h-3 w-3" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--gray-7)] hover:text-[var(--gray-11)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <LuChevronDown className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>

        {/* Label input */}
        <input
          id={labelId}
          type="text"
          value={choice.content ?? ''}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={`Choice ${index + 1}`}
          className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-7)] outline-none focus:border-[var(--gray-5)] focus:bg-[var(--gray-1)] transition-colors"
        />

        {/* Toggle saved-value field */}
        <button
          type="button"
          onClick={onToggleValue}
          title={showValue ? 'Hide saved value' : 'Set saved value (optional)'}
          className={`shrink-0 flex h-5 w-5 items-center justify-center rounded transition-colors ${
            showValue
              ? 'text-[#f76808] bg-[#f7680815]'
              : 'text-[var(--gray-7)] hover:text-[var(--gray-10)] hover:bg-[var(--gray-3)]'
          }`}
        >
          <LuAlignLeft className="h-3 w-3" strokeWidth={2} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          title="Remove choice"
          className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-[var(--gray-7)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LuX className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>

      {/* Expandable saved-value row */}
      {showValue && (
        <div className="px-2 pb-2 border-t border-[var(--gray-4)]">
          <div className="pt-1.5 flex items-center gap-1.5">
            <LuChevronRight className="h-3 w-3 shrink-0 text-[var(--gray-7)]" strokeWidth={2} />
            <input
              type="text"
              value={choice.value ?? ''}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="Saved value (defaults to label)"
              className="flex-1 min-w-0 rounded-md border border-[var(--gray-4)] bg-[var(--gray-1)] px-2 py-1 text-[11.5px] text-[var(--gray-11)] placeholder:text-[var(--gray-7)] outline-none focus:border-[#f76808] transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function ChoiceInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  // Typed option accessors
  const isMultiple = Boolean(options.isMultipleChoice ?? false);
  const isDynamic = Boolean(options.isDynamic ?? false);
  const isSearchable = Boolean(options.isSearchable ?? false);
  const buttonLabel = typeof options.buttonLabel === 'string' ? options.buttonLabel : 'Send';
  const searchPlaceholder =
    typeof options.searchInputPlaceholder === 'string' ? options.searchInputPlaceholder : '';
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;
  const dynamicVariableId =
    typeof options.dynamicVariableId === 'string' ? options.dynamicVariableId : undefined;

  const choices = getChoices(block);

  // Track which rows have the saved-value field expanded
  const [expandedValues, setExpandedValues] = useState<Set<string>>(() => new Set());

  const updateOptions = useCallback(
    (patch: Record<string, unknown>) =>
      onBlockChange({ ...block, options: { ...options, ...patch } }),
    [block, options, onBlockChange],
  );

  const updateItems = useCallback(
    (next: ChoiceItem[]) => onBlockChange({ ...block, items: next }),
    [block, onBlockChange],
  );

  /* ── Choice list operations ── */

  const addChoice = useCallback(() => {
    updateItems([...choices, makeChoice()]);
  }, [choices, updateItems]);

  const deleteChoice = useCallback(
    (id: string) => {
      updateItems(choices.filter((c) => c.id !== id));
      setExpandedValues((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [choices, updateItems],
  );

  const updateChoice = useCallback(
    (id: string, patch: Partial<ChoiceItem>) => {
      updateItems(choices.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [choices, updateItems],
  );

  const moveChoice = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const next = [...choices];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return;
      // Swap
      const tmp = next[index];
      next[index] = next[swapIdx];
      next[swapIdx] = tmp;
      updateItems(next);
    },
    [choices, updateItems],
  );

  const toggleValueExpanded = useCallback((id: string) => {
    setExpandedValues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ── Render ── */

  return (
    <div className="space-y-5">
      <PanelHeader icon={LuListChecks} title="Choice Input" />

      {/* ── Mode selector: Static vs Dynamic ── */}
      <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)] overflow-hidden">
        <button
          type="button"
          onClick={() => updateOptions({ isDynamic: false })}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
            !isDynamic
              ? 'bg-[#f7680812] text-[#f76808]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)]'
          }`}
        >
          <LuListChecks className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="text-[12px] font-medium">Static choices</span>
        </button>
        <button
          type="button"
          onClick={() => updateOptions({ isDynamic: true })}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
            isDynamic
              ? 'bg-[#f7680812] text-[#f76808]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)]'
          }`}
        >
          <LuZap className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="text-[12px] font-medium">Dynamic choices</span>
        </button>
      </div>

      {/* ── Static choices list ── */}
      {!isDynamic && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
              Choices
            </label>
            {choices.length > 0 && (
              <span className="text-[11px] text-[var(--gray-7)]">
                {choices.length} item{choices.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {choices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] py-5 text-center">
              <LuListChecks
                className="mx-auto h-5 w-5 text-[var(--gray-6)] mb-1.5"
                strokeWidth={1.5}
              />
              <p className="text-[11.5px] text-[var(--gray-8)]">No choices yet — add one below</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {choices.map((choice, idx) => (
                <ChoiceRow
                  key={choice.id}
                  choice={choice}
                  index={idx}
                  total={choices.length}
                  showValue={expandedValues.has(choice.id)}
                  onToggleValue={() => toggleValueExpanded(choice.id)}
                  onChange={(patch) => updateChoice(choice.id, patch)}
                  onDelete={() => deleteChoice(choice.id)}
                  onMoveUp={() => moveChoice(idx, 'up')}
                  onMoveDown={() => moveChoice(idx, 'down')}
                />
              ))}
            </div>
          )}

          {/* Add choice button */}
          <button
            type="button"
            onClick={addChoice}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-5)] py-2 text-[12px] font-medium text-[var(--gray-8)] hover:border-[#f76808] hover:text-[#f76808] hover:bg-[#f7680808] transition-colors"
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add choice
          </button>
        </div>
      )}

      {/* ── Dynamic choices variable picker ── */}
      {isDynamic && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2.5 flex items-start gap-2">
            <LuZap
              className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#f76808]"
              strokeWidth={2}
            />
            <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
              Point to a variable holding a{' '}
              <strong>JSON array of strings</strong>, e.g.{' '}
              <code className="bg-[var(--gray-3)] px-1 rounded text-[10.5px]">
                {`["Option A","Option B"]`}
              </code>
            </p>
          </div>
          <Field label="Dynamic choices variable">
            <VariableSelect
              variables={variables}
              value={dynamicVariableId}
              onChange={(id) => updateOptions({ dynamicVariableId: id })}
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
        <ToggleRow
          label="Allow multiple selection"
          description="User can pick more than one option"
          checked={isMultiple}
          onToggle={() => updateOptions({ isMultipleChoice: !isMultiple })}
        />

        {/* Button label — only for multi-select */}
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

        <Divider />

        {/* Searchable toggle */}
        <ToggleRow
          label="Searchable"
          description="Show a search box above the choices"
          checked={isSearchable}
          onToggle={() => updateOptions({ isSearchable: !isSearchable })}
        />

        {/* Search placeholder — only when searchable */}
        {isSearchable && (
          <Field label="Search placeholder">
            <div className="relative">
              <LuSearch
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="text"
                value={searchPlaceholder}
                onChange={(e) => updateOptions({ searchInputPlaceholder: e.target.value })}
                placeholder="Search…"
                className={`${inputClass} pl-8`}
              />
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}
