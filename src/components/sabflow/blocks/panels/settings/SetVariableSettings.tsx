'use client';
import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import { cn } from '@/lib/utils';

type ValueMode = 'static' | 'expression';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

export function SetVariableSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const valueMode: ValueMode = (options.valueMode as ValueMode) ?? 'static';

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Variable name">
        {variables.length > 0 ? (
          <div className="space-y-2">
            <select
              value={String(options.variableName ?? '')}
              onChange={(e) => update({ variableName: e.target.value })}
              className={inputClass}
            >
              <option value="">— Select variable —</option>
              {variables.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--gray-8)]">
              Or type a new variable name:
            </p>
          </div>
        ) : null}
        <input
          type="text"
          value={String(options.variableName ?? '')}
          onChange={(e) => update({ variableName: e.target.value })}
          placeholder="myVariable"
          className={cn(inputClass, variables.length > 0 ? 'mt-1' : '')}
        />
      </Field>

      <Field label="Value type">
        <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-0.5">
          {(['static', 'expression'] as ValueMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ valueMode: mode })}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
                valueMode === mode
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {mode === 'static' ? 'Static value' : 'Expression'}
            </button>
          ))}
        </div>
      </Field>

      <Field label={valueMode === 'expression' ? 'Expression' : 'Value'}>
        <VariableInput
          value={String(options.value ?? '')}
          onChange={(value) => update({ value })}
          placeholder={
            valueMode === 'expression'
              ? '{{firstName}} + " " + {{lastName}}'
              : 'Enter a static value…'
          }
          variables={variables}
          multiline={valueMode === 'expression'}
        />
        {valueMode === 'expression' && (
          <p className="text-[11px] text-[var(--gray-8)] mt-1.5 leading-relaxed">
            Combine variables and text.
            Result is stored in the variable above.
          </p>
        )}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
