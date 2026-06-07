'use client';

import { LuGitBranch, LuPlus, LuTrash2 } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Button,
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* -- Types --------------------------------------------------- */
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
  greater_than: 'greater than',
  less_than: 'less than',
  greater_or_equal: 'greater than or equal',
  less_or_equal: 'less than or equal',
  matches_regex: 'matches regex',
  not_match_regex: 'does not match regex',
};

/** Operators that don't require a right-hand value */
const VALUE_LESS_OPERATORS: Operator[] = ['is_empty', 'is_not_empty'];

const LOGICAL_ITEMS: ReadonlyArray<{ value: LogicalOp; label: string }> = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
];

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

/* -- Helpers ------------------------------------------------- */
function makeCondition(): Condition {
  return { id: crypto.randomUUID(), variableId: '', operator: 'equals', value: '' };
}

/* -- Main component ------------------------------------------ */
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

      {/* Logical operator toggle, shown only when more than one condition */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--st-text-secondary)]">Match</span>
          <SegmentedControl<LogicalOp>
            items={LOGICAL_ITEMS}
            value={logicalOp}
            onChange={(op) => updateOptions({ logicalOperator: op })}
            size="sm"
            aria-label="Match all or any conditions"
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

      {/* Add condition button */}
      <Button
        variant="outline"
        block
        iconLeft={LuPlus}
        onClick={addCondition}
      >
        Add condition
      </Button>

      <p className="text-[11px] text-[var(--st-text-tertiary)] leading-relaxed">
        Visual if/else branches are managed on the canvas via the block's output handles.
      </p>
    </div>
  );
}

/* -- Condition row ------------------------------------------- */
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
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 space-y-2">
      {index > 0 && (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] -mt-1 pb-1 border-b border-[var(--st-border)]">
          condition {index + 1}
        </div>
      )}

      {/* Left operand: variable picker */}
      <Field label="Variable">
        <VariableSelect
          variables={variables}
          value={condition.variableId || undefined}
          onChange={(id) => onUpdate({ variableId: id ?? '' })}
          placeholder="Select variable"
        />
      </Field>

      {/* Operator */}
      <Field label="Operator">
        <Select
          value={condition.operator}
          onValueChange={(op) => onUpdate({ operator: op as Operator })}
        >
          <SelectTrigger aria-label="Operator">
            <SelectValue placeholder="Select operator" />
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

      {/* Right operand, hidden for valueless operators */}
      {needsValue && (
        <Field label="Value">
          <Input
            type="text"
            value={condition.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="value or {{variable}}"
          />
        </Field>
      )}

      {/* Remove */}
      {canRemove && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={LuTrash2}
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
