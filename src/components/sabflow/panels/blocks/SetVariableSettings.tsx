'use client';

import {
  Variable as VariableIcon,
  Braces,
  CalendarDays,
  Clock,
  Hash,
  Code2,
  ListPlus,
  Plus,
  Minus,
  X,
  Divide,
  Eraser,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Textarea,
  Switch,
  Callout,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { PanelHeader, Divider } from './shared/primitives';
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
  icon: LucideIcon;
  /** True when no further input is needed, value is computed at runtime. */
  isAuto: boolean;
  /** True when the value field accepts {{variable}} interpolation. */
  supportsVariables?: boolean;
}

const VALUE_TYPE_CONFIG: Record<ValueType, ValueTypeConfig> = {
  custom: {
    label: 'Custom value',
    description: 'Set an arbitrary string (supports {{variable}} tokens).',
    icon: Braces,
    isAuto: false,
    supportsVariables: true,
  },
  empty: {
    label: 'Empty',
    description: 'Clears the variable (sets it to an empty string).',
    icon: Eraser,
    isAuto: true,
  },
  today: {
    label: "Today's date",
    description: 'Sets to the current date as an ISO 8601 date string (YYYY-MM-DD).',
    icon: CalendarDays,
    isAuto: true,
  },
  now: {
    label: 'Now',
    description: 'Sets to the current date-time as a full ISO 8601 timestamp.',
    icon: Clock,
    isAuto: true,
  },
  random_id: {
    label: 'Random ID',
    description: 'Generates a random UUID v4 at runtime.',
    icon: Hash,
    isAuto: true,
  },
  code: {
    label: 'Result of code',
    description: 'Evaluate a JavaScript expression. The return value is stored.',
    icon: Code2,
    isAuto: false,
  },
  append: {
    label: 'Append value(s)',
    description: 'Appends to the existing value (concatenation for strings, push for arrays).',
    icon: ListPlus,
    isAuto: false,
    supportsVariables: true,
  },
  sum: {
    label: 'Sum',
    description: 'Numeric: variable + value.',
    icon: Plus,
    isAuto: false,
    supportsVariables: true,
  },
  subtract: {
    label: 'Subtract',
    description: 'Numeric: variable - value.',
    icon: Minus,
    isAuto: false,
    supportsVariables: true,
  },
  multiply: {
    label: 'Multiply',
    description: 'Numeric: variable x value.',
    icon: X,
    isAuto: false,
    supportsVariables: true,
  },
  divide: {
    label: 'Divide',
    description: 'Numeric: variable / value.',
    icon: Divide,
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
  subtract: '-',
  multiply: 'x',
  divide: '/',
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
      <PanelHeader icon={VariableIcon} title="Set Variable" />

      {/* ── Variable to set ──────────────────────────── */}
      <Field label="Variable to set">
        <VariableSelect
          variables={variables}
          value={typeof options.variableId === 'string' ? options.variableId : undefined}
          onChange={(id) => update({ variableId: id })}
          placeholder="Select variable"
        />
      </Field>

      <Divider />

      {/* ── Value type selector ──────────────────────── */}
      <Field label="Value type">
        <Select
          value={valueType}
          onValueChange={(value) => update({ valueType: value as ValueType })}
        >
          <SelectTrigger aria-label="Value type">
            <SelectValue placeholder="Select a value type" />
          </SelectTrigger>
          <SelectContent>
            {VALUE_TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {VALUE_TYPE_CONFIG[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Type badge + description */}
      <Callout icon={TypeIcon}>{cfg.description}</Callout>

      {/* ── Auto types: no further input needed ──────── */}
      {cfg.isAuto && (
        <Callout tone="info" icon={Clock}>
          The value will be resolved automatically at runtime.
        </Callout>
      )}

      {/* ── Custom value ─────────────────────────────── */}
      {valueType === 'custom' && (
        <Field label="Value" help={<VariableHint />}>
          <Input
            type="text"
            value={String(options.value ?? '')}
            onChange={(e) => update({ value: e.target.value })}
            placeholder="Enter value or {{variable}}"
            iconRight={Braces}
          />
        </Field>
      )}

      {/* ── Append ───────────────────────────────────── */}
      {valueType === 'append' && (
        <Field label="Value to append" help={<VariableHint />}>
          <Input
            type="text"
            value={String(options.value ?? '')}
            onChange={(e) => update({ value: e.target.value })}
            placeholder="Value or {{variable}}"
            iconRight={Braces}
          />
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
          <Field
            label="JavaScript expression"
            help={
              <>
                Variables are interpolated before evaluation.{' '}
                <code className="font-mono text-[var(--st-text)]">return</code> the value to store.
              </>
            }
          >
            <Textarea
              value={String(options.code ?? '')}
              onChange={(e) => update({ code: e.target.value })}
              rows={7}
              placeholder={'// Return the value to store\nreturn {{inputVar}} + " world";'}
              spellCheck={false}
              className="min-h-[130px] resize-y font-mono"
            />
          </Field>

          {/* Run on client toggle */}
          <div className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
            <div className="space-y-0.5">
              <span className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text)]">
                Run on client
              </span>
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                Needed for{' '}
                <code className="font-mono text-[10px]">window</code> /{' '}
                <code className="font-mono text-[10px]">document</code> access.
              </p>
            </div>
            <Switch
              checked={isRunOnClient}
              onCheckedChange={(next) => update({ runOnClient: next })}
              aria-label="Run code on the client"
            />
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
    <Field label={labelMap[op] ?? 'Operand value'} help={<VariableHint />}>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px] font-semibold text-[var(--st-text)]">
          {symbol}
        </span>
        <div className="flex-1">
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="42 or {{variable}}"
            iconRight={Braces}
          />
        </div>
      </div>
    </Field>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared micro-components
   ══════════════════════════════════════════════════════════ */

function VariableHint() {
  return (
    <span className="flex items-center gap-1">
      <Braces className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      Use{' '}
      <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
        {'{{variable}}'}
      </code>{' '}
      to reference collected values.
    </span>
  );
}
