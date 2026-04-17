'use client';

import type { Block, MergeMode, MergeOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
};

const MODE_DESCRIPTIONS: Record<MergeMode, string> = {
  append: 'Concatenate every input into one array.',
  mergeByKey: 'Join items from both inputs sharing the same key (SQL-style).',
  multiplex: 'Cartesian product across all inputs.',
  pickFirst: 'Pass through the first non-empty input.',
};

export function MergeSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as MergeOptions;
  const mode: MergeMode = options.mode ?? 'append';

  const update = (patch: Partial<MergeOptions>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Mode">
        <select
          className={inputClass}
          value={mode}
          onChange={(e) => update({ mode: e.target.value as MergeMode })}
        >
          <option value="append">Append</option>
          <option value="mergeByKey">Merge by key</option>
          <option value="multiplex">Multiplex</option>
          <option value="pickFirst">Pick first</option>
        </select>
        <p className="mt-1 text-[11px] text-[var(--gray-10)]">
          {MODE_DESCRIPTIONS[mode]}
        </p>
      </Field>

      {mode === 'mergeByKey' && (
        <>
          <Field label="Merge by field">
            <input
              type="text"
              className={inputClass}
              value={options.mergeByField ?? ''}
              onChange={(e) => update({ mergeByField: e.target.value })}
              placeholder="e.g. userId"
            />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-[var(--gray-12)]">
            <input
              type="checkbox"
              checked={options.includeUnpaired ?? false}
              onChange={(e) => update({ includeUnpaired: e.target.checked })}
            />
            Include items with no match
          </label>
        </>
      )}
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
