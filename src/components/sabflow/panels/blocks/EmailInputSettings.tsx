'use client';

import { LuMail } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import { Field, PanelHeader, inputClass } from './shared/primitives';

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
      <PanelHeader icon={LuMail} title="Email Input" />

      <Field label="Placeholder text">
        <input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="your@email.com"
          className={inputClass}
        />
      </Field>

      <Field label="Invalid email message">
        <input
          type="text"
          value={retryMessage}
          onChange={(e) => update({ retryMessage: e.target.value })}
          placeholder="This email is not valid. Please, try again!"
          className={inputClass}
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
