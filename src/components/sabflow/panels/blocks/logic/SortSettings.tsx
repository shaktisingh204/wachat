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
        <Input
          type="text"
          value={options.arrayPath ?? ''}
          onChange={(e) => update({ arrayPath: e.target.value })}
          placeholder="{{items}} or $json.users"
        />
      </Field>

      <Field label="Sort by field">
        <Input
          type="text"
          value={options.sortBy ?? ''}
          onChange={(e) => update({ sortBy: e.target.value })}
          placeholder="createdAt or user.name"
        />
      </Field>

      <Field label="Direction">
        <Select
          value={options.direction ?? 'asc'}
          onValueChange={(value) =>
            update({ direction: value as 'asc' | 'desc' })
          }
        >
          <SelectTrigger aria-label="Direction">
            <SelectValue placeholder="Select direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
