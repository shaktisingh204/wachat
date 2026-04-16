'use client';

import { LuHash } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import { Field, PanelHeader, inputClass } from './shared/primitives';

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

  const toNum = (v: unknown): string =>
    v !== undefined && v !== null ? String(v) : '';

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuHash} title="Number Input" />

      <Field label="Placeholder text">
        <input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="Enter a number…"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Min">
          <input
            type="number"
            value={toNum(options.min)}
            onChange={(e) =>
              update({ min: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            placeholder="—"
            className={inputClass}
          />
        </Field>
        <Field label="Max">
          <input
            type="number"
            value={toNum(options.max)}
            onChange={(e) =>
              update({ max: e.target.value === '' ? undefined : Number(e.target.value) })
            }
            placeholder="—"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Step">
        <input
          type="number"
          value={toNum(options.step)}
          onChange={(e) =>
            update({ step: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          placeholder="1"
          min={0}
          className={inputClass}
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>
    </div>
  );
}
