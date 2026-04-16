'use client';

import { LuLink } from 'react-icons/lu';
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

export function UrlInputSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const placeholder = String(options.placeholder ?? '');
  const variableId = typeof options.variableId === 'string' ? options.variableId : undefined;
  const requireHttps = Boolean(options.requireHttps ?? false);

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuLink} title="URL Input" />

      <Field label="Placeholder text">
        <input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="https://…"
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
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Require HTTPS
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={requireHttps}
            onClick={() => update({ requireHttps: !requireHttps })}
            className={toggleClass(requireHttps)}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                requireHttps ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
