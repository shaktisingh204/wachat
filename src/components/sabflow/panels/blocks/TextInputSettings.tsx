'use client';

import { LuType } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { VariableSelect } from './shared/VariableSelect';
import {
  Field,
  PanelHeader,
  CollapsibleSection,
  inputClass,
  toggleClass,
} from './shared/primitives';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

function toIntOrUndef(raw: string): number | undefined {
  if (raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function TextInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const placeholder = String(options.placeholder ?? '');
  const buttonLabel = String(options.buttonLabel ?? 'Send');
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;
  const isLong = Boolean(options.isLong ?? false);

  const minLength =
    typeof options.minLength === 'number' ? options.minLength : undefined;
  const maxLength =
    typeof options.maxLength === 'number' ? options.maxLength : undefined;
  const pattern = typeof options.pattern === 'string' ? options.pattern : '';
  const patternMessage =
    typeof options.patternMessage === 'string' ? options.patternMessage : '';

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuType} title="Text Input" />

      {/* Long text toggle */}
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          Long text (textarea)
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={isLong}
          onClick={() => update({ isLong: !isLong })}
          className={toggleClass(isLong)}
        >
          <span
            className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isLong ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <Field label="Placeholder text">
        <input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="Type your answer…"
          className={inputClass}
        />
      </Field>

      <Field label="Button label">
        <input
          type="text"
          value={buttonLabel}
          onChange={(e) => update({ buttonLabel: e.target.value })}
          placeholder="Send"
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

      <CollapsibleSection title="Validation">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min length">
            <input
              type="number"
              min={0}
              value={minLength ?? ''}
              onChange={(e) => update({ minLength: toIntOrUndef(e.target.value) })}
              placeholder="—"
              className={inputClass}
            />
          </Field>
          <Field label="Max length">
            <input
              type="number"
              min={0}
              value={maxLength ?? ''}
              onChange={(e) => update({ maxLength: toIntOrUndef(e.target.value) })}
              placeholder="—"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Regex pattern">
          <input
            type="text"
            value={pattern}
            onChange={(e) => update({ pattern: e.target.value || undefined })}
            placeholder="^[A-Z0-9]+$"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
        <Field label="Pattern error message">
          <input
            type="text"
            value={patternMessage}
            onChange={(e) => update({ patternMessage: e.target.value || undefined })}
            placeholder="Value does not match the expected format"
            className={inputClass}
          />
        </Field>
      </CollapsibleSection>
    </div>
  );
}
