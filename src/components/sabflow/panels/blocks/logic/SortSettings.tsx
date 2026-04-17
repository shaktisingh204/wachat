'use client';

import type { Block, SortOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

export function SortSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as SortOptions;

  const update = (patch: Partial<SortOptions>) =>
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

      <Field label="Sort by field">
        <input
          type="text"
          className={inputClass}
          value={options.sortBy ?? ''}
          onChange={(e) => update({ sortBy: e.target.value })}
          placeholder="createdAt or user.name"
        />
      </Field>

      <Field label="Direction">
        <select
          className={inputClass}
          value={options.direction ?? 'asc'}
          onChange={(e) =>
            update({ direction: e.target.value as 'asc' | 'desc' })
          }
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
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
