'use client';

import { LuGitFork, LuPlus, LuX, LuArrowRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type SwitchOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'regex'
  | 'is_empty'
  | 'is_not_empty';

export interface SwitchCase {
  id: string;
  /** Human-friendly label shown on the output port */
  label: string;
  /** Value to test against (left-hand side) — same for all cases */
  operator: SwitchOperator;
  /** Expected value for this case */
  value: string;
  /** Hex accent color for this branch port */
  color: string;
}

export interface SwitchNodeConfig {
  /** The variable/expression being switched on */
  switchValue: string;
  cases: SwitchCase[];
  /** Whether to add a default (fallthrough) output for unmatched items */
  hasDefault: boolean;
  /** Label for the default output */
  defaultLabel: string;
}

export type SwitchNodeProps = {
  config: SwitchNodeConfig;
  onChange: (config: SwitchNodeConfig) => void;
  className?: string;
};

/* ── Constants ───────────────────────────────────────────── */

const OPERATOR_LABELS: Record<SwitchOperator, string> = {
  equals:       '= equals',
  not_equals:   '≠ not equals',
  contains:     '∋ contains',
  not_contains: '∌ not contains',
  starts_with:  '^ starts with',
  ends_with:    '$ ends with',
  greater_than: '> greater than',
  less_than:    '< less than',
  regex:        '~ matches regex',
  is_empty:     '∅ is empty',
  is_not_empty: '◉ is not empty',
};

const UNARY_OPS: SwitchOperator[] = ['is_empty', 'is_not_empty'];

const BRANCH_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ec4899',
  '#0ea5e9', '#a855f7', '#f59e0b', '#14b8a6',
];

let _id = 0;
function makeCase(idx: number): SwitchCase {
  return {
    id: `sw-${++_id}`,
    label: `Case ${idx + 1}`,
    operator: 'equals',
    value: '',
    color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
  };
}

/* ── Component ───────────────────────────────────────────── */

export function SwitchNode({ config, onChange, className }: SwitchNodeProps) {
  const addCase = () =>
    onChange({ ...config, cases: [...config.cases, makeCase(config.cases.length)] });

  const removeCase = (id: string) =>
    onChange({ ...config, cases: config.cases.filter((c) => c.id !== id) });

  const updateCase = (id: string, field: keyof SwitchCase, val: string) =>
    onChange({
      ...config,
      cases: config.cases.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6]">
          <LuGitFork className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Switch</p>
          <p className="text-[11px] text-[var(--gray-9)]">Route items to multiple branches</p>
        </div>
      </div>

      {/* Switch value */}
      <div className="space-y-1.5">
        <Label>Switch On (value to test)</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.switchValue}
          onChange={(e) => onChange({ ...config, switchValue: e.target.value })}
          placeholder="{{data.status}} or {{trigger.type}}"
        />
        <p className="text-[11px] text-[var(--gray-9)]">
          Each case below will be evaluated against this value in order.
        </p>
      </div>

      {/* Cases */}
      <div className="space-y-2">
        <Label>Cases</Label>

        {config.cases.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--gray-5)] py-6 text-center text-[12px] text-[var(--gray-9)]">
            <LuGitFork className="mx-auto mb-2 h-5 w-5 opacity-30" strokeWidth={1.5} />
            No cases — add one below
          </div>
        )}

        {config.cases.map((c, idx) => (
          <CaseRow
            key={c.id}
            case_={c}
            index={idx}
            onChange={updateCase}
            onRemove={removeCase}
          />
        ))}

        <button
          type="button"
          onClick={addCase}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
        >
          <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Add case
        </button>
      </div>

      {/* Default / fallthrough */}
      <div className="space-y-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Default Output</p>
            <p className="text-[11px] text-[var(--gray-9)]">Items that match no case go here</p>
          </div>
          <Toggle
            checked={config.hasDefault}
            onChange={(v) => onChange({ ...config, hasDefault: v })}
          />
        </div>

        {config.hasDefault && (
          <input
            type="text"
            className={INPUT_CLS}
            value={config.defaultLabel}
            onChange={(e) => onChange({ ...config, defaultLabel: e.target.value })}
            placeholder="Default"
          />
        )}
      </div>

      {/* Output port summary */}
      <div className="space-y-1.5">
        <Label>Output Ports ({config.cases.length + (config.hasDefault ? 1 : 0)} total)</Label>
        <div className="space-y-1">
          {config.cases.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: c.color }}
              />
              <span className="text-[11.5px] font-medium text-[var(--gray-11)]">{idx}</span>
              <LuArrowRight className="h-3 w-3 text-[var(--gray-7)]" strokeWidth={2} />
              <span className="text-[11.5px] text-[var(--gray-10)] truncate">{c.label || `Case ${idx + 1}`}</span>
            </div>
          ))}
          {config.hasDefault && (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-[var(--gray-7)]" />
              <span className="text-[11.5px] font-medium text-[var(--gray-11)]">{config.cases.length}</span>
              <LuArrowRight className="h-3 w-3 text-[var(--gray-7)]" strokeWidth={2} />
              <span className="text-[11.5px] text-[var(--gray-10)]">{config.defaultLabel || 'Default'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Case row ────────────────────────────────────────────── */

function CaseRow({
  case_,
  index,
  onChange,
  onRemove,
}: {
  case_: SwitchCase;
  index: number;
  onChange: (id: string, field: keyof SwitchCase, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const isUnary = UNARY_OPS.includes(case_.operator);

  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
      {/* Case header */}
      <div className="flex items-center gap-2">
        {/* Color dot */}
        <input
          type="color"
          value={case_.color}
          onChange={(e) => onChange(case_.id, 'color', e.target.value)}
          className="h-5 w-5 rounded-full border-0 p-0 cursor-pointer shrink-0 bg-transparent"
          title="Branch color"
        />
        <span className="text-[10.5px] font-mono text-[var(--gray-8)] shrink-0">
          Output {index}
        </span>
        <input
          type="text"
          className={cn(INPUT_CLS, 'flex-1 py-1 text-[12px] font-medium')}
          value={case_.label}
          onChange={(e) => onChange(case_.id, 'label', e.target.value)}
          placeholder={`Case ${index + 1}`}
        />
        <button
          type="button"
          onClick={() => onRemove(case_.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Operator */}
      <select
        className={INPUT_CLS}
        value={case_.operator}
        onChange={(e) => onChange(case_.id, 'operator', e.target.value)}
      >
        {(Object.keys(OPERATOR_LABELS) as SwitchOperator[]).map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value (not shown for unary operators) */}
      {!isUnary && (
        <input
          type={case_.operator === 'regex' ? 'text' : 'text'}
          className={cn(INPUT_CLS, case_.operator === 'regex' && 'font-mono')}
          value={case_.value}
          onChange={(e) => onChange(case_.id, 'value', e.target.value)}
          placeholder={case_.operator === 'regex' ? '^order_.*$' : 'expected value or {{variable}}'}
        />
      )}
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
      )}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
