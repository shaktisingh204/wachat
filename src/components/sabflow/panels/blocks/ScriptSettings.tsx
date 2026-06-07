'use client';

import { useState } from 'react';
import { Code, Copy, Check, Braces, Variable } from 'lucide-react';
import type { Block, Variable as FlowVariable } from '@/lib/sabflow/types';
import { Button, Field, Input, Switch, Textarea } from '@/components/sabcrm/20ui';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: FlowVariable[];
};

const BOILERPLATE = `// Available flow variables are injected automatically.
// Return a value to store it in the output variable below.

const result = {{myVariable}};

return result;
`;

export function ScriptSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};
  const code = typeof options.code === 'string' ? options.code : '';
  const runOnClient = Boolean(options.runOnClient ?? false);
  const [copied, setCopied] = useState(false);

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const handleApplyBoilerplate = () => {
    update({ code: BOILERPLATE });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertVariable = (varName: string) => {
    update({ code: code + `{{${varName}}}` });
  };

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
          <Code className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
          Script
        </span>
      </div>

      {/* Code editor area */}
      <Field
        label="JavaScript"
        help="Use {{variableName}} to access flow variables. Return a value to store it below."
      >
        <div className="mb-1.5 flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={copied ? Check : Copy}
            onClick={handleApplyBoilerplate}
          >
            {copied ? 'Applied' : 'Use template'}
          </Button>
        </div>
        <Textarea
          value={code}
          onChange={(e) => update({ code: e.target.value })}
          rows={12}
          placeholder={'// Write your JavaScript here.\n// Use {{variableName}} to access flow variables\n\nreturn "result";'}
          spellCheck={false}
          className="min-h-[200px] resize-y font-mono"
        />
      </Field>

      {/* Run on client toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="block text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Run on client
          </span>
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Enables access to <code className="font-mono">window</code> /{' '}
            <code className="font-mono">document</code>
          </p>
        </div>
        <Switch
          checked={runOnClient}
          onCheckedChange={(next) => update({ runOnClient: next })}
          aria-label="Run on client"
        />
      </div>

      {/* Available variables quick-insert */}
      {variables.length > 0 && (
        <Field
          label="Available variables"
          help="Click a variable to append it to the script."
        >
          <div className="divide-y divide-[var(--st-border)] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            {variables.map((v) => (
              <Button
                key={v.id}
                type="button"
                variant="ghost"
                size="sm"
                iconLeft={Braces}
                block
                onClick={() => insertVariable(v.name)}
                title={`Insert {{${v.name}}}`}
                className="justify-start rounded-none font-mono"
              >
                {`{{${v.name}}}`}
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
          value={typeof options.outputVariable === 'string' ? options.outputVariable : ''}
          onChange={(e) => update({ outputVariable: e.target.value })}
          placeholder="scriptOutput"
          iconRight={Variable}
        />
      </Field>
    </div>
  );
}
