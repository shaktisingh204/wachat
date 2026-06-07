'use client';

import { Type } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Switch } from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';
import { PanelHeader, CollapsibleSection } from './shared/primitives';

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
      <PanelHeader icon={Type} title="Text Input" />

      {/* Long text toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Long text (textarea)
        </span>
        <Switch
          checked={isLong}
          onCheckedChange={(next) => update({ isLong: next })}
          aria-label="Long text (textarea)"
        />
      </div>

      <Field label="Placeholder text">
        <Input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="Type your answer..."
        />
      </Field>

      <Field label="Button label">
        <Input
          type="text"
          value={buttonLabel}
          onChange={(e) => update({ buttonLabel: e.target.value })}
          placeholder="Send"
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
            <Input
              type="number"
              min={0}
              value={minLength ?? ''}
              onChange={(e) => update({ minLength: toIntOrUndef(e.target.value) })}
              placeholder="No limit"
            />
          </Field>
          <Field label="Max length">
            <Input
              type="number"
              min={0}
              value={maxLength ?? ''}
              onChange={(e) => update({ maxLength: toIntOrUndef(e.target.value) })}
              placeholder="No limit"
            />
          </Field>
        </div>
        <Field label="Regex pattern">
          <Input
            type="text"
            value={pattern}
            onChange={(e) => update({ pattern: e.target.value || undefined })}
            placeholder="^[A-Z0-9]+$"
            spellCheck={false}
          />
        </Field>
        <Field label="Pattern error message">
          <Input
            type="text"
            value={patternMessage}
            onChange={(e) => update({ patternMessage: e.target.value || undefined })}
            placeholder="Value does not match the expected format"
          />
        </Field>
      </CollapsibleSection>
    </div>
  );
}
