'use client';

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
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
      <Field
        label="Array path"
        help="Expression or variable holding the array to iterate."
      >
        <Input
          type="text"
          value={options.arrayPath ?? ''}
          onChange={(e) => update({ arrayPath: e.target.value })}
          placeholder="{{items}} or $json.users"
        />
      </Field>

      <Field label="Current item variable">
        <Input
          type="text"
          value={options.itemVariableName ?? ''}
          onChange={(e) => update({ itemVariableName: e.target.value })}
          placeholder="item"
        />
      </Field>

      <Field label="Index variable">
        <Input
          type="text"
          value={options.indexVariableName ?? ''}
          onChange={(e) => update({ indexVariableName: e.target.value })}
          placeholder="index"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch size">
          <Input
            type="number"
            min={1}
            value={String(options.batchSize ?? 1)}
            onChange={(e) => update({ batchSize: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Max iterations">
          <Input
            type="number"
            min={1}
            value={String(options.maxIterations ?? 1000)}
            onChange={(e) => update({ maxIterations: Number(e.target.value) || 1000 })}
          />
        </Field>
      </div>

      <Field label="Mode">
        <Select
          value={options.mode ?? 'sequential'}
          onValueChange={(value) => update({ mode: value as 'sequential' | 'parallel' })}
        >
          <SelectTrigger aria-label="Loop mode">
            <SelectValue placeholder="Select a mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sequential">Sequential</SelectItem>
            <SelectItem value="parallel">Parallel</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {options.mode === 'parallel' && (
        <Field label="Concurrency">
          <Input
            type="number"
            min={1}
            value={String(options.concurrency ?? 5)}
            onChange={(e) => update({ concurrency: Number(e.target.value) || 1 })}
          />
        </Field>
      )}

      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5 text-[11px] text-[var(--st-text-secondary)]">
        <strong className="text-[var(--st-text)]">Outputs:</strong> Loop (per
        item), Done (completion), Error.
      </div>
    </div>
  );
}
