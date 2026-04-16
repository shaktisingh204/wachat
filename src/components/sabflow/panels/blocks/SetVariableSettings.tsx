'use client';

import { LuVariable, LuBraces } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, inputClass, selectClass, toggleClass, PanelHeader } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ──────────────────────────────────────────────────── */
type ValueType =
  | 'custom'
  | 'empty'
  | 'environment'
  | 'moment'
  | 'result'
  | 'moment_id'
  | 'base_url'
  | 'transcript'
  | 'code';

const VALUE_TYPE_LABELS: Record<ValueType, string> = {
  custom: 'Custom',
  empty: 'Empty',
  environment: 'Environment name',
  moment: 'Moment of the day',
  result: 'Result ID',
  moment_id: 'Moment ID',
  base_url: 'Base URL',
  transcript: 'Transcript',
  code: 'Code (JS expression)',
};

/** Types that produce a value automatically — no user input needed */
const AUTO_TYPES: ValueType[] = ['empty', 'environment', 'moment', 'result', 'moment_id', 'base_url', 'transcript'];

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ─────────────────────────────────────────── */
export function SetVariableSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};
  const valueType: ValueType = (options.valueType as ValueType) ?? 'custom';
  const isRunOnClient = Boolean(options.runOnClient ?? false);

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const isAuto = AUTO_TYPES.includes(valueType);
  const isCode = valueType === 'code';
  const showValue = !isAuto;

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuVariable} title="Set Variable" />

      {/* Variable to set */}
      <Field label="Variable to set">
        <VariableSelect
          variables={variables}
          value={typeof options.variableId === 'string' ? options.variableId : undefined}
          onChange={(id) => update({ variableId: id })}
          placeholder="— select variable —"
        />
      </Field>

      {/* Value type selector */}
      <Field label="Value type">
        <select
          value={valueType}
          onChange={(e) => update({ valueType: e.target.value as ValueType })}
          className={selectClass}
        >
          {(Object.keys(VALUE_TYPE_LABELS) as ValueType[]).map((t) => (
            <option key={t} value={t}>
              {VALUE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      {/* Auto-value info banner */}
      {isAuto && (
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5 text-[12px] text-[var(--gray-9)] leading-relaxed">
          <span className="font-medium text-[var(--gray-11)]">{VALUE_TYPE_LABELS[valueType]}</span>{' '}
          will be resolved automatically at runtime.
        </div>
      )}

      {/* Custom value input (text / expression) */}
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
        </Field>
      )}

      {/* Code (JS expression) */}
      {isCode && (
        <>
          <Field label="JavaScript expression">
            <textarea
              value={String(options.code ?? '')}
              onChange={(e) => update({ code: e.target.value })}
              rows={6}
              placeholder={'// Return the value to store\nreturn {{inputVar}} + " world";'}
              spellCheck={false}
              className={cn(
                'w-full rounded-lg border border-[var(--gray-5)] bg-[#0d0d0d]',
                'px-3 py-3 font-mono text-[12px] text-green-400 leading-relaxed',
                'outline-none focus:border-[#f76808] resize-y min-h-[120px]',
                'placeholder:text-[var(--gray-7)] transition-colors',
              )}
            />
          </Field>

          {/* Run on client toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
                Run on client
              </span>
              <p className="text-[11px] text-[var(--gray-8)]">
                Needed for <code className="font-mono">window</code> / <code className="font-mono">document</code>
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
                className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${isRunOnClient ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
