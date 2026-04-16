'use client';

import {
  LuVariable,
  LuBraces,
  LuCalendarDays,
  LuClock,
  LuHash,
  LuCode2,
  LuListPlus,
  LuPlus,
  LuMinus,
  LuX,
  LuDivide,
  LuEraser,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, inputClass, selectClass, toggleClass, PanelHeader, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

type ValueType =
  | 'custom'
  | 'empty'
  | 'today'
  | 'now'
  | 'random_id'
  | 'code'
  | 'append'
  | 'sum'
  | 'subtract'
  | 'multiply'
  | 'divide';

interface ValueTypeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** True when no further input is needed — value is computed at runtime. */
  isAuto: boolean;
  /** True when the value field accepts {{variable}} interpolation. */
  supportsVariables?: boolean;
}

const VALUE_TYPE_CONFIG: Record<ValueType, ValueTypeConfig> = {
  custom: {
    label: 'Custom value',
    description: 'Set an arbitrary string (supports {{variable}} tokens).',
    icon: LuBraces,
    isAuto: false,
    supportsVariables: true,
  },
  empty: {
    label: 'Empty',
    description: 'Clears the variable (sets it to an empty string).',
    icon: LuEraser,
    isAuto: true,
  },
  today: {
    label: "Today's date",
    description: 'Sets to the current date as an ISO 8601 date string (YYYY-MM-DD).',
    icon: LuCalendarDays,
    isAuto: true,
  },
  now: {
    label: 'Now',
    description: 'Sets to the current date-time as a full ISO 8601 timestamp.',
    icon: LuClock,
    isAuto: true,
  },
  random_id: {
    label: 'Random ID',
    description: 'Generates a random UUID v4 at runtime.',
    icon: LuHash,
    isAuto: true,
  },
  code: {
    label: 'Result of code',
    description: 'Evaluate a JavaScript expression — the return value is stored.',
    icon: LuCode2,
    isAuto: false,
  },
  append: {
    label: 'Append value(s)',
    description: 'Appends to the existing value (concatenation for strings, push for arrays).',
    icon: LuListPlus,
    isAuto: false,
    supportsVariables: true,
  },
  sum: {
    label: 'Sum',
    description: 'Numeric: variable + value.',
    icon: LuPlus,
    isAuto: false,
    supportsVariables: true,
  },
  subtract: {
    label: 'Subtract',
    description: 'Numeric: variable − value.',
    icon: LuMinus,
    isAuto: false,
    supportsVariables: true,
  },
  multiply: {
    label: 'Multiply',
    description: 'Numeric: variable × value.',
    icon: LuX,
    isAuto: false,
    supportsVariables: true,
  },
  divide: {
    label: 'Divide',
    description: 'Numeric: variable ÷ value.',
    icon: LuDivide,
    isAuto: false,
    supportsVariables: true,
  },
};

const VALUE_TYPE_ORDER: ValueType[] = [
  'custom',
  'empty',
  'today',
  'now',
  'random_id',
  'code',
  'append',
  'sum',
  'subtract',
  'multiply',
  'divide',
];

/* ── Numeric operator types ─── */
const NUMERIC_TYPES: ValueType[] = ['sum', 'subtract', 'multiply', 'divide'];

/* ── Symbol map for numeric ops ─── */
const NUMERIC_OP_SYMBOL: Partial<Record<ValueType, string>> = {
  sum: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

/* ══════════════════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════════════════ */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ══════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════ */

export function SetVariableSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};
  const valueType: ValueType = (options.valueType as ValueType) ?? 'custom';
  const isRunOnClient = Boolean(options.runOnClient ?? false);

  const cfg = VALUE_TYPE_CONFIG[valueType];

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const TypeIcon = cfg.icon;

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuVariable} title="Set Variable" />

      {/* ── Variable to set ──────────────────────────── */}
      <Field label="Variable to set">
        <VariableSelect
          variables={variables}
          value={typeof options.variableId === 'string' ? options.variableId : undefined}
          onChange={(id) => update({ variableId: id })}
          placeholder="— select variable —"
        />
      </Field>

      <Divider />

      {/* ── Value type selector ──────────────────────── */}
      <Field label="Value type">
        <select
          value={valueType}
          onChange={(e) => update({ valueType: e.target.value as ValueType })}
          className={selectClass}
        >
          {VALUE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {VALUE_TYPE_CONFIG[t].label}
            </option>
          ))}
        </select>
      </Field>

      {/* Type badge + description */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#f7680818] text-[#f76808]">
          <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </div>
        <p className="text-[11.5px] text-[var(--gray-9)] leading-relaxed">{cfg.description}</p>
      </div>

      {/* ── Auto types: no further input needed ──────── */}
      {cfg.isAuto && (
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5 text-[12px] text-[var(--gray-9)]">
          The value will be resolved automatically at runtime.
        </div>
      )}

      {/* ── Custom value ─────────────────────────────── */}
      {valueType === 'custom' && (
        <Field label="Value">
          <div className="relative flex items-center">
            <input
              type="text"
              value={String(options.value ?? '')}
              onChange={(e) => update({ value: e.target.value })}
              placeholder="Enter value or {{variable}}"
              className={cn(inputClass, 'pr-8')}
            />
            <LuBraces
              className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
              strokeWidth={1.8}
            />
          </div>
          <VariableHint />
        </Field>
      )}

      {/* ── Append ───────────────────────────────────── */}
      {valueType === 'append' && (
        <Field label="Value to append">
          <div className="relative flex items-center">
            <input
              type="text"
              value={String(options.value ?? '')}
              onChange={(e) => update({ value: e.target.value })}
              placeholder="Value or {{variable}}"
              className={cn(inputClass, 'pr-8')}
            />
            <LuBraces
              className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
              strokeWidth={1.8}
            />
          </div>
          <VariableHint />
        </Field>
      )}

      {/* ── Numeric operations ───────────────────────── */}
      {NUMERIC_TYPES.includes(valueType) && (
        <NumericOperandField
          op={valueType}
          symbol={NUMERIC_OP_SYMBOL[valueType] ?? ''}
          value={String(options.value ?? '')}
          onChange={(v) => update({ value: v })}
        />
      )}

      {/* ── Code (JS expression) ─────────────────────── */}
      {valueType === 'code' && (
        <>
          <Field label="JavaScript expression">
            <textarea
              value={String(options.code ?? '')}
              onChange={(e) => update({ code: e.target.value })}
              rows={7}
              placeholder={'// Return the value to store\nreturn {{inputVar}} + " world";'}
              spellCheck={false}
              className={cn(
                'w-full rounded-lg border border-[var(--gray-5)] bg-[#0d0d0d]',
                'px-3 py-3 font-mono text-[12px] text-green-400 leading-relaxed',
                'outline-none focus:border-[#f76808] resize-y min-h-[130px]',
                'placeholder:text-[var(--gray-7)] transition-colors',
              )}
            />
            <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
              Variables are interpolated before evaluation.{' '}
              <code className="font-mono text-[#f76808]">return</code> the value to store.
            </p>
          </Field>

          {/* Run on client toggle */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
            <div className="space-y-0.5">
              <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
                Run on client
              </span>
              <p className="text-[11px] text-[var(--gray-8)]">
                Needed for{' '}
                <code className="font-mono text-[10px]">window</code> /{' '}
                <code className="font-mono text-[10px]">document</code> access.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isRunOnClient}
              onClick={() => update({ runOnClient: !isRunOnClient })}
              className={toggleClass(isRunOnClient)}
            >
              <span
                className={cn(
                  'block h-4 w-4 rounded-full bg-white shadow transition-transform',
                  isRunOnClient ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Numeric operand field
   ══════════════════════════════════════════════════════════ */

function NumericOperandField({
  op,
  symbol,
  value,
  onChange,
}: {
  op: ValueType;
  symbol: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelMap: Record<string, string> = {
    sum: 'Add value',
    subtract: 'Subtract value',
    multiply: 'Multiply by',
    divide: 'Divide by',
  };

  return (
    <Field label={labelMap[op] ?? 'Operand value'}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] text-[13px] font-semibold text-[#f76808]">
          {symbol}
        </span>
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="42 or {{variable}}"
            className={cn(inputClass, 'pr-8')}
          />
          <LuBraces
            className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
        </div>
      </div>
      <VariableHint />
    </Field>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared micro-components
   ══════════════════════════════════════════════════════════ */

function VariableHint() {
  return (
    <p className="text-[10.5px] text-[var(--gray-8)] mt-1 flex items-center gap-1">
      <LuBraces className="h-3 w-3 shrink-0" strokeWidth={1.8} />
      Use{' '}
      <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
        {'{{variable}}'}
      </code>{' '}
      to reference collected values.
    </p>
  );
}
