'use client';
import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuCopy, LuCheck, LuBraces } from 'react-icons/lu';

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
      <Field
        label="Script (JavaScript)"
        action={
          <button
            onClick={handleCopyBoilerplate}
            className="flex items-center gap-1 text-[11px] text-[var(--gray-8)] hover:text-[var(--gray-12)] transition-colors"
          >
            {copied ? (
              <LuCheck className="h-3 w-3 text-green-500" strokeWidth={2} />
            ) : (
              <LuCopy className="h-3 w-3" strokeWidth={1.8} />
            )}
            {copied ? 'Applied' : 'Use template'}
          </button>
        }
      >
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
            'placeholder:text-[var(--gray-7)]',
            'transition-colors',
          )}
        />
      </Field>

      {/* Variable reference panel */}
      {variables.length > 0 && (
        <Field label="Available variables">
          <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
            {variables.map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2',
                  'text-left text-[12px] transition-colors',
                  'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
                  'first:rounded-t-lg last:rounded-b-lg',
                )}
                title={`Insert {{${v}}}`}
              >
                <LuBraces className="h-3 w-3 shrink-0 text-[var(--gray-8)]" strokeWidth={1.8} />
                <span className="font-mono">{`{{${v}}}`}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--gray-8)] mt-1">
            Click a variable to insert it at the end of your script.
          </p>
        </Field>
      )}

      {/* Output variable */}
      <Field label="Save return value to">
        <input
          type="text"
          value={String(options.outputVariable ?? '')}
          onChange={(e) => update({ outputVariable: e.target.value })}
          placeholder="scriptOutput"
          className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors"
        />
        <p className="text-[11px] text-[var(--gray-8)] mt-1">
          The value returned by the script is stored in this variable.
        </p>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}
