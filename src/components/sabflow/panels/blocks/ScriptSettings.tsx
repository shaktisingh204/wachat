'use client';

import { useState } from 'react';
import { LuCode, LuCopy, LuCheck, LuBraces, LuVariable } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, inputClass, toggleClass, PanelHeader } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
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
      <PanelHeader icon={LuCode} title="Script" />

      {/* Code editor area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            JavaScript
          </label>
          <button
            type="button"
            onClick={handleApplyBoilerplate}
            className="flex items-center gap-1 text-[11px] text-[var(--gray-8)] hover:text-[var(--gray-12)] transition-colors"
          >
            {copied ? (
              <LuCheck className="h-3 w-3 text-green-500" strokeWidth={2} />
            ) : (
              <LuCopy className="h-3 w-3" strokeWidth={1.8} />
            )}
            {copied ? 'Applied' : 'Use template'}
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => update({ code: e.target.value })}
          rows={12}
          placeholder={`// Write your JavaScript here…\n// Use {{variableName}} to access flow variables\n\nreturn "result";`}
          spellCheck={false}
          className={cn(
            'w-full rounded-lg border border-[var(--gray-5)] bg-[#0d0d0d]',
            'px-3 py-3 font-mono text-[12px] text-green-400 leading-relaxed',
            'outline-none focus:border-[#f76808] resize-y min-h-[200px]',
            'placeholder:text-[var(--gray-7)] transition-colors',
          )}
        />
      </div>

      {/* Run on client toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Run on client
          </span>
          <p className="text-[11px] text-[var(--gray-8)]">
            Enables access to <code className="font-mono">window</code> /{' '}
            <code className="font-mono">document</code>
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={runOnClient}
          onClick={() => update({ runOnClient: !runOnClient })}
          className={toggleClass(runOnClient)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${runOnClient ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      {/* Available variables quick-insert */}
      {variables.length > 0 && (
        <Field label="Available variables">
          <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
            {variables.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => insertVariable(v.name)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2',
                  'text-left text-[12px] transition-colors',
                  'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
                  'first:rounded-t-lg last:rounded-b-lg',
                )}
                title={`Insert {{${v.name}}}`}
              >
                <LuBraces className="h-3 w-3 shrink-0 text-[var(--gray-8)]" strokeWidth={1.8} />
                <span className="font-mono">{`{{${v.name}}}`}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--gray-8)] mt-1">
            Click a variable to append it to the script.
          </p>
        </Field>
      )}

      {/* Output variable */}
      <Field label="Save return value to">
        <div className="relative flex items-center">
          <input
            type="text"
            value={typeof options.outputVariable === 'string' ? options.outputVariable : ''}
            onChange={(e) => update({ outputVariable: e.target.value })}
            placeholder="scriptOutput"
            className={cn(inputClass, 'pr-8')}
          />
          <LuVariable
            className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
        </div>
        <p className="text-[11px] text-[var(--gray-8)] mt-1">
          The value returned by the script is stored in this variable.
        </p>
      </Field>
    </div>
  );
}
