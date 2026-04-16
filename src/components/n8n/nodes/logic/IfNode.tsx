'use client';

import { useState } from 'react';
import { LuGitBranch, LuPlus, LuX, LuCheckCircle, LuXCircle } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

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
  /** Left operand — a variable or literal */
  leftValue: string;
  operator: ConditionOperator;
  /** Right operand — only relevant for binary operators */
  rightValue: string;
}

export interface IfNodeConfig {
  /** How multiple conditions are combined */
  combineWith: CombineLogic;
  conditions: Condition[];
}

/** This node always has two outputs: index 0 = true branch, index 1 = false branch */
export type IfNodeOutput = { branch: 'true' | 'false' };

export type IfNodeProps = {
  config: IfNodeConfig;
  onChange: (config: IfNodeConfig) => void;
  className?: string;
};

/* ── Constants ───────────────────────────────────────────── */

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

/** Operators that don't need a right-hand value */
const UNARY_OPERATORS: ConditionOperator[] = [
  'is_empty', 'is_not_empty', 'is_true', 'is_false',
];

let _id = 0;
function makeCondition(): Condition {
  return { id: `cond-${++_id}`, leftValue: '', operator: 'equals', rightValue: '' };
}

/* ── Component ───────────────────────────────────────────── */

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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f97316]/10 text-[#f97316]">
          <LuGitBranch className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">If / Condition</p>
          <p className="text-[11px] text-[var(--gray-9)]">Route items based on conditions</p>
        </div>
      </div>

      {/* Combine logic */}
      {config.conditions.length > 1 && (
        <div className="space-y-1.5">
          <Label>Combine Conditions With</Label>
          <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
            {(['AND', 'OR'] as CombineLogic[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onChange({ ...config, combineWith: l })}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-[12px] font-semibold transition-colors',
                  config.combineWith === l
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--gray-9)]">
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
          <div className="rounded-lg border border-dashed border-[var(--gray-5)] py-6 text-center text-[12px] text-[var(--gray-9)]">
            <LuGitBranch className="mx-auto mb-2 h-5 w-5 opacity-30" strokeWidth={1.5} />
            Add at least one condition
          </div>
        )}

        {config.conditions.map((cond, idx) => (
          <div key={cond.id} className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
            {/* Separator badge between conditions */}
            {idx > 0 && (
              <div className="flex items-center gap-2 -mt-1 mb-1">
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
                <span className="rounded-full border border-[var(--gray-5)] bg-[var(--gray-3)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--gray-9)]">
                  {config.combineWith}
                </span>
                <div className="flex-1 h-px bg-[var(--gray-4)]" />
              </div>
            )}

            {/* Left value */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={cn(INPUT_CLS, 'flex-1')}
                value={cond.leftValue}
                onChange={(e) => updateCondition(cond.id, 'leftValue', e.target.value)}
                placeholder="{{variable}} or literal"
              />
              <button
                type="button"
                onClick={() => removeCondition(cond.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
              >
                <LuX className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            {/* Operator */}
            <select
              className={INPUT_CLS}
              value={cond.operator}
              onChange={(e) => updateCondition(cond.id, 'operator', e.target.value)}
            >
              {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>

            {/* Right value (only for binary operators) */}
            {!isUnary(cond.operator) && (
              <input
                type={cond.operator === 'regex' ? 'text' : 'text'}
                className={cn(INPUT_CLS, cond.operator === 'regex' && 'font-mono')}
                value={cond.rightValue}
                onChange={(e) => updateCondition(cond.id, 'rightValue', e.target.value)}
                placeholder={
                  cond.operator === 'regex' ? '^[0-9]+$' : 'value or {{variable}}'
                }
              />
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
        >
          <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Add condition
        </button>
      </div>

      {/* Output branches */}
      <div className="space-y-1.5">
        <Label>Output Branches</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <LuCheckCircle className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
            <div>
              <p className="text-[12px] font-semibold text-emerald-700">True</p>
              <p className="text-[10.5px] text-emerald-600">Output 0 — condition met</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <LuXCircle className="h-4 w-4 shrink-0 text-red-400" strokeWidth={2} />
            <div>
              <p className="text-[12px] font-semibold text-red-600">False</p>
              <p className="text-[10.5px] text-red-500">Output 1 — condition not met</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
