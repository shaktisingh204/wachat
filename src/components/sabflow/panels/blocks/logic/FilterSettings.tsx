'use client';

import type { Block, FilterOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

export function FilterSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as FilterOptions;

  const update = (patch: Partial<FilterOptions>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Array path">
        <input
          type="text"
          className={inputClass}
          value={options.arrayPath ?? ''}
          onChange={(e) => update({ arrayPath: e.target.value })}
          placeholder="{{items}} or $json.users"
        />
      </Field>

      <Field label="Condition">
        <input
          type="text"
          className={inputClass}
          value={options.condition ?? ''}
          onChange={(e) => update({ condition: e.target.value })}
          placeholder="$item.age > 18"
        />
        <p className="mt-1 text-[11px] text-[var(--gray-10)]">
          Evaluated per item. Items where the expression is truthy flow to the
          Pass pin, otherwise to Fail.
        </p>
      </Field>
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
