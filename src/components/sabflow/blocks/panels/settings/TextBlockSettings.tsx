'use client';
import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

export function TextBlockSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};

  return (
    <div className="space-y-4">
      <Field label="Message text">
        <VariableInput
          value={String(options.content ?? '')}
          onChange={(content) => onUpdate({ options: { ...options, content } })}
          placeholder="Type your message… Use {{variable}} to insert variables"
          variables={variables}
          multiline
        />
      </Field>

      <p className="text-[11px] text-[var(--gray-8)] leading-relaxed">
        Use <code className="font-mono bg-[var(--gray-3)] px-1 rounded">{'{{variableName}}'}</code> to
        insert dynamic values collected earlier in the flow.
      </p>
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
