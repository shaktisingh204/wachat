'use client';

import { LuListChecks } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import { Field, PanelHeader, inputClass, toggleClass } from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

export function ChoiceInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const isMultiple = Boolean(options.isMultipleChoice ?? false);
  const buttonLabel = String(options.buttonLabel ?? 'Send');
  const variableId =
    typeof options.variableId === 'string' ? options.variableId : undefined;

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuListChecks} title="Choice Input" />

      {/* Multiple selection toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          Allow multiple selection
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={isMultiple}
          onClick={() => update({ isMultipleChoice: !isMultiple })}
          className={toggleClass(isMultiple)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isMultiple ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Button label — only relevant for multi-select (confirm button) */}
      {isMultiple && (
        <Field label="Button label">
          <input
            type="text"
            value={buttonLabel}
            onChange={(e) => update({ buttonLabel: e.target.value })}
            placeholder="Send"
            className={inputClass}
          />
        </Field>
      )}

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>

      {/* Informational note */}
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] p-3 text-[11.5px] text-[var(--gray-9)] leading-relaxed">
        Choices are managed by adding items directly on the block in the flow canvas.
      </div>
    </div>
  );
}
