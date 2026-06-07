'use client';

import { Mail } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input } from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

export function EmailInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const placeholder = String(options.placeholder ?? '');
  const retryMessage = String(options.retryMessage ?? 'This email is not valid. Please, try again!');
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <Mail className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Email Input
        </h3>
      </div>

      <Field label="Placeholder text">
        <Input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="your@email.com"
        />
      </Field>

      <Field label="Invalid email message">
        <Input
          type="text"
          value={retryMessage}
          onChange={(e) => update({ retryMessage: e.target.value })}
          placeholder="This email is not valid. Please, try again!"
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>
    </div>
  );
}
