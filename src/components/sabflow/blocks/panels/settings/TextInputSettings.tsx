'use client';

import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import {
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

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
        <Input
          type="text"
          value={String(options.placeholder ?? '')}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="e.g. Type your answer"
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

      <div className="h-px bg-[var(--st-border)]" />

      <Field label="Validation">
        <Select
          value={validationRule}
          onValueChange={(value) => {
            const rule = value as ValidationRule;
            setValidationRule(rule);
            update({ validationRule: rule });
          }}
        >
          <SelectTrigger aria-label="Validation">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VALIDATION_LABELS) as ValidationRule[]).map((rule) => (
              <SelectItem key={rule} value={rule}>
                {VALIDATION_LABELS[rule]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {validationRule === 'minLength' && (
        <Field label="Minimum characters">
          <Input
            type="number"
            min={0}
            value={Number(options.minLength ?? 1)}
            onChange={(e) => update({ minLength: Number(e.target.value) })}
          />
        </Field>
      )}

      {validationRule === 'maxLength' && (
        <Field label="Maximum characters">
          <Input
            type="number"
            min={1}
            value={Number(options.maxLength ?? 255)}
            onChange={(e) => update({ maxLength: Number(e.target.value) })}
          />
        </Field>
      )}

      {validationRule === 'regex' && (
        <Field label="Pattern (regex)">
          <Input
            type="text"
            value={String(options.regexPattern ?? '')}
            onChange={(e) => update({ regexPattern: e.target.value })}
            placeholder="e.g. ^[a-zA-Z]+$"
            className="font-mono text-[12px]"
          />
        </Field>
      )}

      {validationRule !== 'none' && (
        <Field label="Error message">
          <Input
            type="text"
            value={String(options.validationErrorMessage ?? '')}
            onChange={(e) => update({ validationErrorMessage: e.target.value })}
            placeholder="Invalid input. Please try again."
          />
        </Field>
      )}
    </div>
  );
}
