'use client';

import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  LuPlus,
  LuX,
  LuGitBranch,
  LuInfo,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block, Variable, ConditionOptions, ConditionGroup, Comparison, ComparisonOperator } from '@/lib/sabflow/types';
import { PanelHeader, selectClass, inputClass } from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPARISON_OPERATORS: ComparisonOperator[] = [
  'Equal to',
  'Not equal to',
  'Contains',
  'Does not contain',
  'Starts with',
  'Ends with',
  'Greater than',
  'Less than',
  'Greater than or equal',
  'Less than or equal',
  'Is empty',
  'Is not empty',
  'Matches regex',
];

/** Operators that do not require a right-hand value input */
const VALUE_LESS_OPERATORS = new Set<ComparisonOperator>(['Is empty', 'Is not empty']);

// ── Factories ─────────────────────────────────────────────────────────────────

function makeComparison(): Comparison {
  return { id: createId(), operator: 'Equal to' };
}

function makeGroup(): ConditionGroup {
  return { id: createId(), logicalOperator: 'AND', comparisons: [makeComparison()] };
}

function defaultOptions(): ConditionOptions {
  return { logicalOperator: 'AND', conditionGroups: [makeGroup()] };
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables: Variable[];
};

// ── Main component ────────────────────────────────────────────────────────────

export function ConditionSettings({ block, onBlockChange, variables }: Props) {
  const rawOpts = block.options as ConditionOptions | undefined;

  // Migrate or default: ensure we always have the new grouped shape
  const options: ConditionOptions =
    rawOpts?.conditionGroups != null
      ? rawOpts
      : defaultOptions();

  const { logicalOperator, conditionGroups } = options;

  // ── Mutators ───────────────────────────────────────────────────────────────

  const commitOptions = useCallback(
    (patch: Partial<ConditionOptions>) => {
      onBlockChange({
        ...block,
        options: { ...options, ...patch },
      });
    },
    [block, options, onBlockChange],
  );

  const setTopOperator = useCallback(
    (op: 'AND' | 'OR') => commitOptions({ logicalOperator: op }),
    [commitOptions],
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<ConditionGroup>) => {
      commitOptions({
        conditionGroups: conditionGroups.map((g) =>
          g.id === groupId ? { ...g, ...patch } : g,
        ),
      });
    },
    [conditionGroups, commitOptions],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      const next = conditionGroups.filter((g) => g.id !== groupId);
      commitOptions({ conditionGroups: next.length > 0 ? next : [makeGroup()] });
    },
    [conditionGroups, commitOptions],
  );

  const addGroup = useCallback(() => {
    commitOptions({ conditionGroups: [...conditionGroups, makeGroup()] });
  }, [conditionGroups, commitOptions]);

  const addComparison = useCallback(
    (groupId: string) => {
      updateGroup(groupId, {
        comparisons: [
          ...(conditionGroups.find((g) => g.id === groupId)?.comparisons ?? []),
          makeComparison(),
        ],
      });
    },
    [conditionGroups, updateGroup],
  );

  const updateComparison = useCallback(
    (groupId: string, compId: string, patch: Partial<Comparison>) => {
      const group = conditionGroups.find((g) => g.id === groupId);
      if (!group) return;
      updateGroup(groupId, {
        comparisons: group.comparisons.map((c) =>
          c.id === compId ? { ...c, ...patch } : c,
        ),
      });
    },
    [conditionGroups, updateGroup],
  );

  const deleteComparison = useCallback(
    (groupId: string, compId: string) => {
      const group = conditionGroups.find((g) => g.id === groupId);
      if (!group) return;
      const next = group.comparisons.filter((c) => c.id !== compId);
      updateGroup(groupId, {
        comparisons: next.length > 0 ? next : [makeComparison()],
      });
    },
    [conditionGroups, updateGroup],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuGitBranch} title="Condition" />

      {/* ── IF header ────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--gray-9)]">
          If
        </span>
        <div className="flex-1 h-px bg-[var(--gray-4)]" />
      </div>

      {/* ── Condition groups ──────────────────────────────── */}
      <div className="space-y-3">
        {conditionGroups.map((group, groupIndex) => (
          <div key={group.id}>
            {/* Between-group logical operator badge */}
            {groupIndex > 0 && (
              <div className="flex items-center gap-2 my-2 px-1">
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
                <LogicPill
                  value={logicalOperator}
                  onChange={setTopOperator}
                  size="sm"
                />
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
              </div>
            )}

            {/* Group card */}
            <ConditionGroupCard
              group={group}
              variables={variables}
              canDelete={conditionGroups.length > 1}
              onGroupOperatorChange={(op) => updateGroup(group.id, { logicalOperator: op })}
              onDeleteGroup={() => deleteGroup(group.id)}
              onAddComparison={() => addComparison(group.id)}
              onUpdateComparison={(compId, patch) => updateComparison(group.id, compId, patch)}
              onDeleteComparison={(compId) => deleteComparison(group.id, compId)}
            />
          </div>
        ))}
      </div>

      {/* ── Add group button ──────────────────────────────── */}
      <button
        type="button"
        onClick={addGroup}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-lg',
          'border border-dashed border-[var(--gray-6)] py-2',
          'text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
          'hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)]',
          'transition-colors',
        )}
      >
        <LuPlus className="h-3.5 w-3.5" strokeWidth={2.2} />
        Add condition group
      </button>

      {/* ── Then hint ─────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5 flex items-start gap-2">
        <LuInfo className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--gray-8)]" strokeWidth={1.8} />
        <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">
          <span className="font-semibold text-[var(--gray-11)]">Then — </span>
          Connect the output edges from this block to define which path to follow when the condition passes or falls through.
        </p>
      </div>
    </div>
  );
}

// ── ConditionGroupCard ────────────────────────────────────────────────────────

type GroupCardProps = {
  group: ConditionGroup;
  variables: Variable[];
  canDelete: boolean;
  onGroupOperatorChange: (op: 'AND' | 'OR') => void;
  onDeleteGroup: () => void;
  onAddComparison: () => void;
  onUpdateComparison: (compId: string, patch: Partial<Comparison>) => void;
  onDeleteComparison: (compId: string) => void;
};

function ConditionGroupCard({
  group,
  variables,
  canDelete,
  onGroupOperatorChange,
  onDeleteGroup,
  onAddComparison,
  onUpdateComparison,
  onDeleteComparison,
}: GroupCardProps) {
  return (
    <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--gray-5)] bg-[var(--gray-3)]">
        <span className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--gray-9)] flex-1">
          Group
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={onDeleteGroup}
            title="Delete group"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-5)] hover:text-red-500 transition-colors"
          >
            <LuX className="h-3 w-3" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Comparisons */}
      <div className="p-3 space-y-2">
        {group.comparisons.map((comp, idx) => (
          <div key={comp.id}>
            {/* Between-comparison logical operator badge */}
            {idx > 0 && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
                <LogicPill
                  value={group.logicalOperator}
                  onChange={onGroupOperatorChange}
                  size="xs"
                />
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
              </div>
            )}

            <ComparisonRow
              comparison={comp}
              variables={variables}
              canDelete={group.comparisons.length > 1}
              onUpdate={(patch) => onUpdateComparison(comp.id, patch)}
              onDelete={() => onDeleteComparison(comp.id)}
            />
          </div>
        ))}
      </div>

      {/* Add comparison footer */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onAddComparison}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg',
            'border border-dashed border-[var(--gray-5)] py-1.5',
            'text-[11.5px] text-[var(--gray-8)] hover:text-[var(--gray-12)]',
            'hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]',
            'transition-colors',
          )}
        >
          <LuPlus className="h-3 w-3" strokeWidth={2.2} />
          Add comparison
        </button>
      </div>
    </div>
  );
}

// ── ComparisonRow ─────────────────────────────────────────────────────────────

type ComparisonRowProps = {
  comparison: Comparison;
  variables: Variable[];
  canDelete: boolean;
  onUpdate: (patch: Partial<Comparison>) => void;
  onDelete: () => void;
};

function ComparisonRow({
  comparison,
  variables,
  canDelete,
  onUpdate,
  onDelete,
}: ComparisonRowProps) {
  const needsValue = !VALUE_LESS_OPERATORS.has(comparison.operator ?? 'Equal to');

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-2.5 space-y-2">
      {/* Variable + delete row */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <VariableSelect
            variables={variables}
            value={comparison.variableId}
            onChange={(variableId) => onUpdate({ variableId })}
            placeholder="— pick variable —"
          />
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Remove comparison"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded text-[var(--gray-7)] hover:bg-[var(--gray-4)] hover:text-red-500 transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {/* Operator select */}
      <select
        value={comparison.operator ?? 'Equal to'}
        onChange={(e) =>
          onUpdate({ operator: e.target.value as ComparisonOperator })
        }
        className={selectClass}
      >
        {COMPARISON_OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      {/* Value input (hidden for valueless operators) */}
      {needsValue && (
        <input
          type={comparison.operator === 'Matches regex' ? 'text' : 'text'}
          value={comparison.value ?? ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={
            comparison.operator === 'Matches regex'
              ? '/pattern/flags or plain pattern'
              : 'value or {{variable}}'
          }
          className={inputClass}
        />
      )}
    </div>
  );
}

// ── LogicPill ─────────────────────────────────────────────────────────────────

type LogicPillProps = {
  value: 'AND' | 'OR';
  onChange: (op: 'AND' | 'OR') => void;
  size: 'sm' | 'xs';
};

function LogicPill({ value, onChange, size }: LogicPillProps) {
  const containerCls = cn(
    'flex rounded-full bg-[var(--gray-3)] border border-[var(--gray-5)] p-0.5 shrink-0',
  );
  const btnBase = cn(
    'rounded-full font-semibold transition-colors',
    size === 'xs' ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-0.5 text-[11px]',
  );

  return (
    <div className={containerCls}>
      {(['AND', 'OR'] as const).map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={cn(
            btnBase,
            value === op
              ? 'bg-[#f76808] text-white shadow-sm'
              : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
          )}
        >
          {op}
        </button>
      ))}
    </div>
  );
}
