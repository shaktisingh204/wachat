'use client';

import { Link } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Switch } from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';

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
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-accent)]">
          <Link className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          URL Input
        </h3>
      </div>

      <Field label="Placeholder text">
        <Input
          type="text"
          value={placeholder}
          onChange={(e) => update({ placeholder: e.target.value })}
          placeholder="https://example.com"
        />
      </Field>

      <Field label="Save answer to variable">
        <VariableSelect
          variables={variables}
          value={variableId}
          onChange={(id) => update({ variableId: id })}
        />
      </Field>

      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Validation
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Require HTTPS
          </span>
          <Switch
            checked={requireHttps}
            onCheckedChange={(next) => update({ requireHttps: next })}
            aria-label="Require HTTPS"
          />
        </div>
      </div>
    </div>
  );
}
