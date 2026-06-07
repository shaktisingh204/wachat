'use client';

import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import {
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';

type ValueMode = 'static' | 'expression';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

const VALUE_MODES: ReadonlyArray<{ value: ValueMode; label: string }> = [
  { value: 'static', label: 'Static value' },
  { value: 'expression', label: 'Expression' },
];

export function SetVariableSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const valueMode: ValueMode = (options.valueMode as ValueMode) ?? 'static';
  const variableName = String(options.variableName ?? '');

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Variable name">
        {variables.length > 0 ? (
          <div className="space-y-2">
            <Select
              value={variableName || undefined}
              onValueChange={(value) => update({ variableName: value })}
            >
              <SelectTrigger aria-label="Existing variable">
                <SelectValue placeholder="Select variable" />
              </SelectTrigger>
              <SelectContent>
                {variables.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-[var(--st-text-tertiary)]">
              Or type a new variable name:
            </p>
          </div>
        ) : null}
        <Input
          type="text"
          value={variableName}
          onChange={(e) => update({ variableName: e.target.value })}
          placeholder="myVariable"
          aria-label="New variable name"
          className={variables.length > 0 ? 'mt-1' : undefined}
        />
      </Field>

      <Field label="Value type">
        <SegmentedControl<ValueMode>
          items={VALUE_MODES}
          value={valueMode}
          onChange={(mode) => update({ valueMode: mode })}
          fullWidth
          aria-label="Value type"
        />
      </Field>

      <Field
        label={valueMode === 'expression' ? 'Expression' : 'Value'}
        help={
          valueMode === 'expression'
            ? 'Combine variables and text. Result is stored in the variable above.'
            : undefined
        }
      >
        <VariableInput
          value={String(options.value ?? '')}
          onChange={(value) => update({ value })}
          placeholder={
            valueMode === 'expression'
              ? '{{firstName}} + " " + {{lastName}}'
              : 'Enter a static value'
          }
          variables={variables}
          multiline={valueMode === 'expression'}
        />
      </Field>
    </div>
  );
}
