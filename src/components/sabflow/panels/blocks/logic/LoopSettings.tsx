'use client';

import type { Block, LoopOptions } from '@/lib/sabflow/types';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables: string[];
};

export function LoopSettings({ block, onUpdate }: Props) {
  const options = (block.options ?? {}) as LoopOptions;

  const update = (patch: Partial<LoopOptions>) =>
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
        <p className="mt-1 text-[11px] text-[var(--gray-10)]">
          Expression or variable holding the array to iterate.
        </p>
      </Field>

      <Field label="Current item variable">
        <input
          type="text"
          className={inputClass}
          value={options.itemVariableName ?? ''}
          onChange={(e) => update({ itemVariableName: e.target.value })}
          placeholder="item"
        />
      </Field>

      <Field label="Index variable">
        <input
          type="text"
          className={inputClass}
          value={options.indexVariableName ?? ''}
          onChange={(e) => update({ indexVariableName: e.target.value })}
          placeholder="index"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch size">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={String(options.batchSize ?? 1)}
            onChange={(e) => update({ batchSize: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Max iterations">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={String(options.maxIterations ?? 1000)}
            onChange={(e) => update({ maxIterations: Number(e.target.value) || 1000 })}
          />
        </Field>
      </div>

      <Field label="Mode">
        <select
          className={inputClass}
          value={options.mode ?? 'sequential'}
          onChange={(e) => update({ mode: e.target.value as 'sequential' | 'parallel' })}
        >
          <option value="sequential">Sequential</option>
          <option value="parallel">Parallel</option>
        </select>
      </Field>

      {options.mode === 'parallel' && (
        <Field label="Concurrency">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={String(options.concurrency ?? 5)}
            onChange={(e) => update({ concurrency: Number(e.target.value) || 1 })}
          />
        </Field>
      )}

      <div className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-2.5 text-[11px] text-[var(--gray-10)]">
        <strong className="text-[var(--gray-12)]">Outputs:</strong> Loop (per
        item) · Done (completion) · Error.
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
