'use client';

import { LuGitBranch, LuPlus, LuTrash2 } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, inputClass, toggleClass, PanelHeader } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ──────────────────────────────────────────────────── */
type LogicalOp = 'AND' | 'OR';

type Operator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'matches_regex'
  | 'not_match_regex';

const OPERATOR_LABELS: Record<Operator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  greater_than: '>',
  less_than: '<',
  greater_or_equal: '>=',
  less_or_equal: '<=',
  matches_regex: 'matches regex',
  not_match_regex: 'does not match regex',
};

/** Operators that don't require a right-hand value */
const VALUE_LESS_OPERATORS: Operator[] = ['is_empty', 'is_not_empty'];

type Condition = {
  id: string;
  /** Variable ID from the flow */
  variableId: string;
  operator: Operator;
  value: string;
};

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Helpers ────────────────────────────────────────────────── */
function makeCondition(): Condition {
  return { id: crypto.randomUUID(), variableId: '', operator: 'equals', value: '' };
}

/* ── Main component ─────────────────────────────────────────── */
export function ConditionSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};
  const logicalOp: LogicalOp = (options.logicalOperator as LogicalOp) ?? 'AND';
  const conditions: Condition[] =
    Array.isArray(options.conditions) && (options.conditions as Condition[]).length > 0
      ? (options.conditions as Condition[])
      : [makeCondition()];

  const updateOptions = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const updateConditions = (updated: Condition[]) =>
    updateOptions({ conditions: updated });

  const updateCondition = (id: string, patch: Partial<Condition>) =>
    updateConditions(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addCondition = () => updateConditions([...conditions, makeCondition()]);

  const removeCondition = (id: string) => {
    const next = conditions.filter((c) => c.id !== id);
    updateConditions(next.length > 0 ? next : [makeCondition()]);
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuGitBranch} title="Condition" />

      {/* Logical operator toggle — shown only when more than one condition */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--gray-9)]">Match</span>
          <div className="flex rounded-lg bg-[var(--gray-3)] p-0.5">
            {(['AND', 'OR'] as LogicalOp[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => updateOptions({ logicalOperator: op })}
                className={cn(
                  'rounded-md px-3 py-1 text-[12px] font-medium transition-colors',
                  logicalOp === op
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                )}
              >
                {op}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] text-[var(--gray-9)]">conditions</span>
        </div>
      )}

      {/* Condition rows */}
      <div className="space-y-2">
        {conditions.map((cond, index) => (
          <ConditionRow
            key={cond.id}
            condition={cond}
            index={index}
            variables={variables}
            onUpdate={(patch) => updateCondition(cond.id, patch)}
            onRemove={() => removeCondition(cond.id)}
            canRemove={conditions.length > 1}
          />
        ))}
      </div>

      {/* Add condition button */}
      <button
        type="button"
        onClick={addCondition}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-lg',
          'border border-dashed border-[var(--gray-6)] py-2',
          'text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
          'hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)]',
          'transition-colors',
        )}
      >
        <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
        Add condition
      </button>

      <p className="text-[11px] text-[var(--gray-8)] leading-relaxed">
        Visual if/else branches are managed on the canvas via the block's output handles.
      </p>
    </div>
  );
}

/* ── Condition row ──────────────────────────────────────────── */
function ConditionRow({
  condition,
  index,
  variables,
  onUpdate,
  onRemove,
  canRemove,
}: {
  condition: Condition;
  index: number;
  variables: Variable[];
  onUpdate: (patch: Partial<Condition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const needsValue = !VALUE_LESS_OPERATORS.includes(condition.operator);

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
      {index > 0 && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gray-8)] -mt-1 pb-1 border-b border-[var(--gray-4)]">
          condition {index + 1}
        </div>
      )}

      {/* Left operand: variable picker */}
      <Field label="Variable">
        <VariableSelect
          variables={variables}
          value={condition.variableId || undefined}
          onChange={(id) => onUpdate({ variableId: id ?? '' })}
          placeholder="— select variable —"
        />
      </Field>

      {/* Operator */}
      <Field label="Operator">
        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as Operator })}
          className={inputClass}
        >
          {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </Field>

      {/* Right operand — hidden for valueless operators */}
      {needsValue && (
        <Field label="Value">
          <input
            type="text"
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="value or {{variable}}"
            className={inputClass}
          />
        </Field>
      )}

      {/* Remove */}
      {canRemove && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-[11px] text-[var(--gray-8)] hover:text-red-500 transition-colors"
          >
            <LuTrash2 className="h-3 w-3" strokeWidth={1.8} />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
