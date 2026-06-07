'use client';

import {
  Field,
  Input,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

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
      <Field label="Mode" help={MODE_DESCRIPTIONS[mode]}>
        <Select
          value={mode}
          onValueChange={(value) => update({ mode: value as MergeMode })}
        >
          <SelectTrigger aria-label="Merge mode">
            <SelectValue placeholder="Select a mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="append">Append</SelectItem>
            <SelectItem value="mergeByKey">Merge by key</SelectItem>
            <SelectItem value="multiplex">Multiplex</SelectItem>
            <SelectItem value="pickFirst">Pick first</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {mode === 'mergeByKey' && (
        <>
          <Field label="Merge by field">
            <Input
              type="text"
              value={options.mergeByField ?? ''}
              onChange={(e) => update({ mergeByField: e.target.value })}
              placeholder="e.g. userId"
            />
          </Field>
          <Checkbox
            checked={options.includeUnpaired ?? false}
            onChange={(e) => update({ includeUnpaired: e.target.checked })}
            label="Include items with no match"
          />
        </>
      )}
    </div>
  );
}
