'use client';

import { useState, useCallback } from 'react';
import {
  ListChecks,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Zap,
  Search,
  AlignLeft,
  ChevronRight,
} from 'lucide-react';
import { createId } from '@paralleldrive/cuid2';
import type { Block, ChoiceItem, Variable } from '@/lib/sabflow/types';
import {
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Switch,
  SegmentedControl,
  EmptyState,
  Callout,
  Badge,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';

/* -- Types ----------------------------------------------------------------- */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* -- Helpers --------------------------------------------------------------- */

function makeChoice(): ChoiceItem {
  return { id: createId(), content: '', value: '' };
}

function getChoices(block: Block): ChoiceItem[] {
  const items = block.items ?? [];
  return items as ChoiceItem[];
}

/* -- Toggle row ------------------------------------------------------------ */

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
        <p className="text-[12.5px] font-medium text-[var(--st-text)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--st-text-secondary)] mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        size="sm"
        aria-label={label}
      />
    </div>
  );
}

/* -- Choice row ------------------------------------------------------------ */

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
  return (
    <Card variant="outlined" padding="none" className="group overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Reorder buttons */}
        <div className="flex flex-col shrink-0">
          <IconButton
            label="Move up"
            icon={ChevronUp}
            size="sm"
            onClick={onMoveUp}
            disabled={index === 0}
          />
          <IconButton
            label="Move down"
            icon={ChevronDown}
            size="sm"
            onClick={onMoveDown}
            disabled={index === total - 1}
          />
        </div>

        {/* Label input */}
        <Input
          inputSize="sm"
          value={choice.content ?? ''}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={`Choice ${index + 1}`}
          aria-label={`Choice ${index + 1} label`}
          className="flex-1 min-w-0"
        />

        {/* Toggle saved-value field */}
        <IconButton
          label={showValue ? 'Hide saved value' : 'Set saved value (optional)'}
          icon={AlignLeft}
          size="sm"
          variant={showValue ? 'primary' : 'ghost'}
          aria-pressed={showValue}
          onClick={onToggleValue}
        />

        {/* Delete */}
        <IconButton
          label="Remove choice"
          icon={X}
          size="sm"
          variant="danger"
          onClick={onDelete}
        />
      </div>

      {/* Expandable saved-value row */}
      {showValue && (
        <div className="px-2 pb-2 border-t border-[var(--st-border)]">
          <div className="pt-1.5 flex items-center gap-1.5">
            <ChevronRight
              className="h-3 w-3 shrink-0 text-[var(--st-text-tertiary)]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <Input
              inputSize="sm"
              value={choice.value ?? ''}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="Saved value (defaults to label)"
              aria-label="Saved value"
              className="flex-1 min-w-0"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/* -- Main component -------------------------------------------------------- */

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

  /* -- Choice list operations -- */

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

  /* -- Render -- */

  return (
    <div className="space-y-5">
      {/* Panel header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--st-border)]">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
          aria-hidden="true"
        >
          <ListChecks className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <span className="text-[12px] font-semibold text-[var(--st-text)] uppercase tracking-wide">
          Choice Input
        </span>
      </div>

      {/* -- Mode selector: Static vs Dynamic -- */}
      <SegmentedControl
        fullWidth
        aria-label="Choice source"
        value={isDynamic ? 'dynamic' : 'static'}
        onChange={(v) => updateOptions({ isDynamic: v === 'dynamic' })}
        items={[
          { value: 'static', label: 'Static choices', icon: ListChecks },
          { value: 'dynamic', label: 'Dynamic choices', icon: Zap },
        ]}
      />

      {/* -- Static choices list -- */}
      {!isDynamic && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
              Choices
            </span>
            {choices.length > 0 && (
              <Badge tone="neutral" kind="soft">
                {choices.length} item{choices.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {choices.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              size="sm"
              title="No choices yet"
              description="Add one below to get started."
            />
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
          <Button variant="outline" block iconLeft={Plus} onClick={addChoice}>
            Add choice
          </Button>
        </div>
      )}

      {/* -- Dynamic choices variable picker -- */}
      {isDynamic && (
        <div className="space-y-3">
          <Callout tone="info" icon={Zap}>
            Point to a variable holding a <strong>JSON array of strings</strong>, e.g.{' '}
            <code className="bg-[var(--st-bg-secondary)] px-1 rounded-[var(--st-radius-sm)] text-[10.5px]">
              {`["Option A","Option B"]`}
            </code>
          </Callout>
          <Field label="Dynamic choices variable">
            <VariableSelect
              variables={variables}
              value={dynamicVariableId}
              onChange={(id) => updateOptions({ dynamicVariableId: id })}
              placeholder="Select variable"
            />
          </Field>
        </div>
      )}

      <div className="h-px bg-[var(--st-border)]" />

      {/* -- Settings section -- */}
      <div className="space-y-4">
        <p className="text-[11.5px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide">
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

        {/* Button label - only for multi-select */}
        {isMultiple && (
          <Field label="Submit button label">
            <Input
              value={buttonLabel}
              onChange={(e) => updateOptions({ buttonLabel: e.target.value })}
              placeholder="Send"
            />
          </Field>
        )}

        <div className="h-px bg-[var(--st-border)]" />

        {/* Searchable toggle */}
        <ToggleRow
          label="Searchable"
          description="Show a search box above the choices"
          checked={isSearchable}
          onToggle={() => updateOptions({ isSearchable: !isSearchable })}
        />

        {/* Search placeholder - only when searchable */}
        {isSearchable && (
          <Field label="Search placeholder">
            <Input
              iconLeft={Search}
              value={searchPlaceholder}
              onChange={(e) => updateOptions({ searchInputPlaceholder: e.target.value })}
              placeholder="Search..."
            />
          </Field>
        )}
      </div>
    </div>
  );
}
