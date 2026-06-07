'use client';

import { GitBranch, Plus, X, CheckCircle2, XCircle } from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  Field,
  Input,
  Label,
  SegmentedControl,
  Badge,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui';

/* -- Types ------------------------------------------------------ */

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_true'
  | 'is_false'
  | 'regex';

export type CombineLogic = 'AND' | 'OR';

export interface Condition {
  id: string;
  /** Left operand: a variable or literal. */
  leftValue: string;
  operator: ConditionOperator;
  /** Right operand: only relevant for binary operators. */
  rightValue: string;
}

export interface IfNodeConfig {
  /** How multiple conditions are combined. */
  combineWith: CombineLogic;
  conditions: Condition[];
}

/** This node always has two outputs: index 0 = true branch, index 1 = false branch. */
export type IfNodeOutput = { branch: 'true' | 'false' };

export type IfNodeProps = {
  config: IfNodeConfig;
  onChange: (config: IfNodeConfig) => void;
  className?: string;
};

/* -- Constants -------------------------------------------------- */

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals:                  '= equals',
  not_equals:              '≠ not equals',
  contains:                '∋ contains',
  not_contains:            '∌ not contains',
  starts_with:             '^ starts with',
  ends_with:               '$ ends with',
  greater_than:            '> greater than',
  less_than:               '< less than',
  greater_than_or_equal:   '≥ greater or equal',
  less_than_or_equal:      '≤ less or equal',
  is_empty:                '∅ is empty',
  is_not_empty:            '◉ is not empty',
  is_true:                 '✓ is true',
  is_false:                '✗ is false',
  regex:                   '~ matches regex',
};

/** Operators that don't need a right-hand value. */
const UNARY_OPERATORS: ConditionOperator[] = [
  'is_empty', 'is_not_empty', 'is_true', 'is_false',
];

let _id = 0;
function makeCondition(): Condition {
  return { id: `cond-${++_id}`, leftValue: '', operator: 'equals', rightValue: '' };
}

/* -- Component -------------------------------------------------- */

export function IfNode({ config, onChange, className }: IfNodeProps) {
  const addCondition = () =>
    onChange({ ...config, conditions: [...config.conditions, makeCondition()] });

  const removeCondition = (id: string) =>
    onChange({ ...config, conditions: config.conditions.filter((c) => c.id !== id) });

  const updateCondition = (id: string, field: keyof Condition, val: string) =>
    onChange({
      ...config,
      conditions: config.conditions.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    });

  const isUnary = (op: ConditionOperator) => UNARY_OPERATORS.includes(op);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
          <GitBranch className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">If / Condition</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Route items based on conditions</p>
        </div>
      </div>

      {/* Combine logic */}
      {config.conditions.length > 1 && (
        <div className="space-y-1.5">
          <Label>Combine Conditions With</Label>
          <SegmentedControl<CombineLogic>
            aria-label="Combine conditions with"
            fullWidth
            value={config.combineWith}
            onChange={(l) => onChange({ ...config, combineWith: l })}
            items={[
              { value: 'AND', label: 'AND' },
              { value: 'OR', label: 'OR' },
            ]}
          />
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            {config.combineWith === 'AND'
              ? 'All conditions must be true to take the True branch.'
              : 'At least one condition must be true to take the True branch.'}
          </p>
        </div>
      )}

      {/* Conditions */}
      <div className="space-y-2">
        <Label>Conditions</Label>

        {config.conditions.length === 0 && (
          <EmptyState
            size="sm"
            icon={GitBranch}
            title="Add at least one condition"
            description="Conditions decide which items take the True branch."
          />
        )}

        {config.conditions.map((cond, idx) => (
          <Card key={cond.id} padding="sm" className="space-y-2">
            <CardBody className="space-y-2">
              {/* Separator badge between conditions */}
              {idx > 0 && (
                <div className="flex items-center gap-2 -mt-1 mb-1">
                  <div className="flex-1 h-px bg-[var(--st-border)]" />
                  <Badge tone="neutral" kind="outline">{config.combineWith}</Badge>
                  <div className="flex-1 h-px bg-[var(--st-border)]" />
                </div>
              )}

              {/* Left value */}
              <div className="flex items-center gap-2">
                <Field label="Left value" className="flex-1">
                  <Input
                    value={cond.leftValue}
                    onChange={(e) => updateCondition(cond.id, 'leftValue', e.target.value)}
                    placeholder="{{variable}} or literal"
                  />
                </Field>
                <IconButton
                  icon={X}
                  label="Remove condition"
                  size="sm"
                  onClick={() => removeCondition(cond.id)}
                />
              </div>

              {/* Operator */}
              <Field label="Operator">
                <Select
                  value={cond.operator}
                  onValueChange={(v) => updateCondition(cond.id, 'operator', v)}
                >
                  <SelectTrigger aria-label="Operator">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                      <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Right value (only for binary operators) */}
              {!isUnary(cond.operator) && (
                <Field label="Right value">
                  <Input
                    className={cn(cond.operator === 'regex' && 'font-mono')}
                    value={cond.rightValue}
                    onChange={(e) => updateCondition(cond.id, 'rightValue', e.target.value)}
                    placeholder={
                      cond.operator === 'regex' ? '^[0-9]+$' : 'value or {{variable}}'
                    }
                  />
                </Field>
              )}
            </CardBody>
          </Card>
        ))}

        <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addCondition}>
          Add condition
        </Button>
      </div>

      {/* Output branches */}
      <div className="space-y-1.5">
        <Label>Output Branches</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card padding="sm" className="flex items-center gap-2">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-[var(--st-status-ok)]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <div>
              <p className="text-[12px] font-semibold text-[var(--st-text)]">True</p>
              <p className="text-[10.5px] text-[var(--st-text-secondary)]">Output 0, condition met</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-2">
            <XCircle
              className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]"
              strokeWidth={2}
              aria-hidden="true"
            />
            <div>
              <p className="text-[12px] font-semibold text-[var(--st-text)]">False</p>
              <p className="text-[10.5px] text-[var(--st-text-secondary)]">Output 1, condition not met</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
