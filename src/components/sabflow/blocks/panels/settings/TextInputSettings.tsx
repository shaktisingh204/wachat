'use client';
import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import { cn } from '@/lib/utils';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

type ValidationRule = 'none' | 'minLength' | 'maxLength' | 'regex';

const VALIDATION_LABELS: Record<ValidationRule, string> = {
  none: 'None',
  minLength: 'Min length',
  maxLength: 'Max length',
  regex: 'Regex pattern',
};

export function TextInputSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const [validationRule, setValidationRule] = useState<ValidationRule>(
    (options.validationRule as ValidationRule) ?? 'none',
  );

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Placeholder text">
        <input
          type="text"
          value={String(options.placeholder ?? '')}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="e.g. Type your answer…"
          className={inputClass}
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableInput
          value={String(options.variableName ?? '')}
          onChange={(variableName) => update({ variableName })}
          placeholder="{{answerVariable}}"
          variables={variables}
        />
      </Field>

      <div className="h-px bg-[var(--gray-4)]" />

      <Field label="Validation">
        <select
          value={validationRule}
          onChange={(e) => {
            const rule = e.target.value as ValidationRule;
            setValidationRule(rule);
            update({ validationRule: rule });
          }}
          className={selectClass}
        >
          {(Object.keys(VALIDATION_LABELS) as ValidationRule[]).map((rule) => (
            <option key={rule} value={rule}>
              {VALIDATION_LABELS[rule]}
            </option>
          ))}
        </select>
      </Field>

      {validationRule === 'minLength' && (
        <Field label="Minimum characters">
          <input
            type="number"
            min={0}
            value={Number(options.minLength ?? 1)}
            onChange={(e) => update({ minLength: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>
      )}

      {validationRule === 'maxLength' && (
        <Field label="Maximum characters">
          <input
            type="number"
            min={1}
            value={Number(options.maxLength ?? 255)}
            onChange={(e) => update({ maxLength: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>
      )}

      {validationRule === 'regex' && (
        <Field label="Pattern (regex)">
          <input
            type="text"
            value={String(options.regexPattern ?? '')}
            onChange={(e) => update({ regexPattern: e.target.value })}
            placeholder="e.g. ^[a-zA-Z]+$"
            className={cn(inputClass, 'font-mono text-[12px]')}
          />
        </Field>
      )}

      {validationRule !== 'none' && (
        <Field label="Error message">
          <input
            type="text"
            value={String(options.validationErrorMessage ?? '')}
            onChange={(e) => update({ validationErrorMessage: e.target.value })}
            placeholder="Invalid input. Please try again."
            className={inputClass}
          />
        </Field>
      )}
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

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

const selectClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors';
