'use client';
import { useId } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { VariableInput } from '../VariableInput';

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
  | 'less_or_equal';

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
};

/** Operators that don't need a value input */
const VALUE_LESS_OPERATORS: Operator[] = ['is_empty', 'is_not_empty'];

type Condition = {
  id: string;
  variable: string;
  operator: Operator;
  value: string;
};

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

function makeCondition(): Condition {
  return { id: crypto.randomUUID(), variable: '', operator: 'equals', value: '' };
}

export function ConditionSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const logicalOp: LogicalOp = (options.logicalOperator as LogicalOp) ?? 'AND';
  const conditions: Condition[] =
    Array.isArray(options.conditions) && options.conditions.length > 0
      ? (options.conditions as Condition[])
      : [makeCondition()];

  const updateConditions = (updated: Condition[]) =>
    onUpdate({ options: { ...options, conditions: updated } });

  const updateCondition = (id: string, patch: Partial<Condition>) => {
    updateConditions(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCondition = () => updateConditions([...conditions, makeCondition()]);

  const removeCondition = (id: string) => {
    const next = conditions.filter((c) => c.id !== id);
    updateConditions(next.length > 0 ? next : [makeCondition()]);
  };

  return (
    <div className="space-y-3">
      {/* Logical operator toggle */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--gray-9)]">Match</span>
          <div className="flex rounded-lg bg-[var(--gray-3)] p-0.5">
            {(['AND', 'OR'] as LogicalOp[]).map((op) => (
              <button
                key={op}
                onClick={() => onUpdate({ options: { ...options, logicalOperator: op } })}
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

      <button
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
    </div>
  );
}

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
  variables: string[];
  onUpdate: (patch: Partial<Condition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const needsValue = !VALUE_LESS_OPERATORS.includes(condition.operator);

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
      {index > 0 && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gray-8)] -mt-1">
          — OR / AND (see above)
        </div>
      )}

      {/* Variable */}
      <div className="space-y-1">
        <label className="text-[11px] text-[var(--gray-9)] uppercase tracking-wide">Variable</label>
        <VariableInput
          value={condition.variable}
          onChange={(variable) => onUpdate({ variable })}
          placeholder="{{variable}}"
          variables={variables}
        />
      </div>

      {/* Operator */}
      <div className="space-y-1">
        <label className="text-[11px] text-[var(--gray-9)] uppercase tracking-wide">Operator</label>
        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as Operator })}
          className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-1.5 text-[12.5px] text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors"
        >
          {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </div>

      {/* Value */}
      {needsValue && (
        <div className="space-y-1">
          <label className="text-[11px] text-[var(--gray-9)] uppercase tracking-wide">Value</label>
          <VariableInput
            value={condition.value}
            onChange={(value) => onUpdate({ value })}
            placeholder="value or {{variable}}"
            variables={variables}
          />
        </div>
      )}

      {/* Remove button */}
      {canRemove && (
        <div className="flex justify-end pt-1">
          <button
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
