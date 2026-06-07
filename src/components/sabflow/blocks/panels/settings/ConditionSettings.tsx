'use client';

import type { Block } from '@/lib/sabflow/types';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Field,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
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

const LOGICAL_OPS: ReadonlyArray<{ value: LogicalOp; label: string }> = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
];

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
          <span className="text-[11.5px] text-[var(--st-text-secondary)]">Match</span>
          <SegmentedControl
            items={LOGICAL_OPS}
            value={logicalOp}
            onChange={(op) => onUpdate({ options: { ...options, logicalOperator: op } })}
            size="sm"
            aria-label="Match conditions with"
          />
          <span className="text-[11.5px] text-[var(--st-text-secondary)]">conditions</span>
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

      <Button
        variant="outline"
        size="sm"
        block
        iconLeft={Plus}
        onClick={addCondition}
        className="border-dashed"
      >
        Add condition
      </Button>
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
    <Card variant="outlined" padding="sm" className="space-y-2 bg-[var(--st-bg-secondary)]">
      {index > 0 && (
        <div className="-mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)]">
          OR / AND (see above)
        </div>
      )}

      {/* Variable */}
      <Field label="Variable" className="uppercase">
        <VariableInput
          value={condition.variable}
          onChange={(variable) => onUpdate({ variable })}
          placeholder="{{variable}}"
          variables={variables}
        />
      </Field>

      {/* Operator */}
      <Field label="Operator" className="uppercase">
        <Select
          value={condition.operator}
          onValueChange={(operator) => onUpdate({ operator: operator as Operator })}
        >
          <SelectTrigger aria-label="Operator">
            <SelectValue placeholder="Pick an operator" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Value */}
      {needsValue && (
        <Field label="Value" className="uppercase">
          <VariableInput
            value={condition.value}
            onChange={(value) => onUpdate({ value })}
            placeholder="value or {{variable}}"
            variables={variables}
          />
        </Field>
      )}

      {/* Remove button */}
      {canRemove && (
        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" iconLeft={Trash2} onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </Card>
  );
}
