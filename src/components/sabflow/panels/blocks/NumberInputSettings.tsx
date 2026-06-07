'use client';

import { Hash } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Switch } from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';
import { PanelHeader, CollapsibleSection } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

export function NumberInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const placeholder = String(options.placeholder ?? '');
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;
  const integer = Boolean(options.integer ?? false);

  const toNum = (v: unknown): string =>
    v !== undefined && v !== null ? String(v) : '';

  return (
    <div className="space-y-4">
      <PanelHeader icon={Hash} title="Number Input" />

      <Field label="Placeholder text">
        <Input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="Enter a number"
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>

      <CollapsibleSection title="Validation" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min">
            <Input
              type="number"
              value={toNum(options.min)}
              onChange={(e) =>
                update({ min: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="No limit"
            />
          </Field>
          <Field label="Max">
            <Input
              type="number"
              value={toNum(options.max)}
              onChange={(e) =>
                update({ max: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="No limit"
            />
          </Field>
        </div>

        <Field label="Step">
          <Input
            type="number"
            value={toNum(options.step)}
            onChange={(e) =>
              update({ step: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            placeholder="1"
            min={0}
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Whole numbers only
          </span>
          <Switch
            checked={integer}
            onCheckedChange={(next) => update({ integer: next })}
            aria-label="Whole numbers only"
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
