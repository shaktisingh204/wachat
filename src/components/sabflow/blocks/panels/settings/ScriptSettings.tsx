'use client';

import { useId, useState } from 'react';
import { Copy, Check, Braces } from 'lucide-react';

import type { Block } from '@/lib/sabflow/types';
import { Button, Field, Input, Textarea } from '@/components/sabcrm/20ui';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

const BOILERPLATE = `// Available variables are injected automatically.
// Return a value to set the script's output.

const result = {{inputVariable}};

return result;
`;

export function ScriptSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const [copied, setCopied] = useState(false);
  const scriptId = useId();

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  const code = String(options.code ?? '');

  const handleCopyBoilerplate = () => {
    onUpdate({ options: { ...options, code: BOILERPLATE } });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertVariable = (varName: string) => {
    const insertion = `{{${varName}}}`;
    update({ code: code + insertion });
  };

  return (
    <div className="space-y-4">
      {/* Code editor */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={scriptId}
            className="text-xs font-medium text-[var(--st-text-secondary)]"
          >
            Script (JavaScript)
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyBoilerplate}
            iconLeft={copied ? Check : Copy}
          >
            {copied ? 'Applied' : 'Use template'}
          </Button>
        </div>
        <Textarea
          id={scriptId}
          value={code}
          onChange={(e) => update({ code: e.target.value })}
          rows={12}
          placeholder={'// Write your JavaScript here.\n// Use {{variableName}} to access flow variables\n\nreturn "result";'}
          spellCheck={false}
          className="font-mono text-[12px] leading-relaxed min-h-[200px]"
        />
      </div>

      {/* Variable reference panel */}
      {variables.length > 0 && (
        <Field
          label="Available variables"
          help="Click a variable to insert it at the end of your script."
        >
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] divide-y divide-[var(--st-border)]">
            {variables.map((v) => (
              <Button
                key={v}
                variant="ghost"
                block
                onClick={() => insertVariable(v)}
                iconLeft={Braces}
                title={`Insert {{${v}}}`}
                className="justify-start rounded-none first:rounded-t-[var(--st-radius)] last:rounded-b-[var(--st-radius)] font-mono text-[12px]"
              >
                {`{{${v}}}`}
              </Button>
            ))}
          </div>
        </Field>
      )}

      {/* Output variable */}
      <Field
        label="Save return value to"
        help="The value returned by the script is stored in this variable."
      >
        <Input
          type="text"
          value={String(options.outputVariable ?? '')}
          onChange={(e) => update({ outputVariable: e.target.value })}
          placeholder="scriptOutput"
        />
      </Field>
    </div>
  );
}
