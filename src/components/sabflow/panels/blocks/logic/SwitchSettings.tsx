'use client';

import { createId } from '@paralleldrive/cuid2';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import type { Block, SwitchCase, SwitchOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

export function SwitchSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as SwitchOptions;
  const cases: SwitchCase[] = options.cases ?? [];

  const update = (patch: Partial<SwitchOptions>) =>
    onUpdate({ options: { ...options, ...patch } });

  const addCase = () => {
    const index = cases.length + 1;
    update({
      cases: [
        ...cases,
        {
          id: createId(),
          pinId: `case_${index}`,
          label: `Case ${index}`,
          operator: 'equals',
          value: '',
        },
      ],
    });
  };

  const updateCase = (id: string, patch: Partial<SwitchCase>) => {
    update({ cases: cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeCase = (id: string) => {
    update({ cases: cases.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      <Field label="Expression">
        <input
          type="text"
          className={inputClass}
          value={options.expression ?? ''}
          onChange={(e) => update({ expression: e.target.value })}
          placeholder="{{status}} or $json.country"
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Cases
          </label>
          <button
            type="button"
            onClick={addCase}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f76808]/10"
          >
            <LuPlus className="h-3 w-3" />
            Add case
          </button>
        </div>

        {cases.length === 0 && (
          <p className="text-[11.5px] text-[var(--gray-10)] italic">
            No cases yet. Click &ldquo;Add case&rdquo; to route the input based
            on its value.
          </p>
        )}

        {cases.map((c) => (
          <div
            key={c.id}
            className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                className={`${inputClass} flex-1`}
                value={c.label ?? ''}
                onChange={(e) => updateCase(c.id, { label: e.target.value })}
                placeholder="Label"
              />
              <button
                type="button"
                onClick={() => removeCase(c.id)}
                className="rounded p-1 text-[var(--gray-9)] hover:bg-red-500/10 hover:text-red-500"
              >
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className={inputClass}
                value={c.operator ?? 'equals'}
                onChange={(e) =>
                  updateCase(c.id, {
                    operator: e.target.value as SwitchCase['operator'],
                  })
                }
              >
                <option value="equals">equals</option>
                <option value="notEquals">not equals</option>
                <option value="contains">contains</option>
                <option value="greaterThan">greater than</option>
                <option value="lessThan">less than</option>
              </select>
              <input
                type="text"
                className={inputClass}
                value={c.value ?? ''}
                onChange={(e) => updateCase(c.id, { value: e.target.value })}
                placeholder="Compare to…"
              />
            </div>
          </div>
        ))}
      </div>
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
