'use client';

import { Field, Input } from '@/components/sabcrm/20ui';

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
        <Input
          type="text"
          value={options.arrayPath ?? ''}
          onChange={(e) => update({ arrayPath: e.target.value })}
          placeholder="{{items}} or $json.users"
        />
      </Field>

      <Field
        label="Condition"
        help="Evaluated per item. Items where the expression is truthy flow to the Pass pin, otherwise to Fail."
      >
        <Input
          type="text"
          value={options.condition ?? ''}
          onChange={(e) => update({ condition: e.target.value })}
          placeholder="$item.age > 18"
        />
      </Field>
    </div>
  );
}
