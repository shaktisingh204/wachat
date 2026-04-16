'use client';

import { useCallback } from 'react';
import { LuBot } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

/* ── Types ───────────────────────────────────────────────────────────────── */

type MistralModel =
  | 'mistral-large-latest'
  | 'mistral-medium-latest'
  | 'mistral-small-latest'
  | 'open-mistral-7b';

interface MistralOptions {
  apiKey?: string;
  model?: MistralModel;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  responseVariableId?: string;
}

/* ── Model options ───────────────────────────────────────────────────────── */

const MODELS: { value: MistralModel; label: string }[] = [
  { value: 'mistral-large-latest', label: 'Mistral Large (latest)' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium (latest)' },
  { value: 'mistral-small-latest', label: 'Mistral Small (latest)' },
  { value: 'open-mistral-7b', label: 'Open Mistral 7B' },
];

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function MistralSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as MistralOptions;
  const model: MistralModel = opts.model ?? 'mistral-large-latest';
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 1024;

  const update = useCallback(
    (patch: Partial<MistralOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuBot} title="Mistral AI" />

      <Field label="API Key">
        <input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="…"
          autoComplete="off"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Stored in the flow settings. Never exposed to end-users.
        </p>
      </Field>

      <Field label="Model">
        <select
          value={model}
          onChange={(e) => update({ model: e.target.value as MistralModel })}
          className={selectClass}
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Divider />

      <Field label="System prompt">
        <textarea
          value={opts.systemPrompt ?? ''}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant…"
          rows={4}
          spellCheck
          className={`${inputClass} resize-y min-h-[80px]`}
        />
      </Field>

      <Field label="Save response to">
        <VariableSelect
          variables={variables}
          value={opts.responseVariableId}
          onChange={(id) => update({ responseVariableId: id })}
          placeholder="— select variable —"
        />
      </Field>

      <Divider />

      <Field label={`Temperature — ${temperature.toFixed(1)}`}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0">0</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
            className="flex-1 accent-[#f76808]"
          />
          <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0 text-right">1</span>
        </div>
        <p className="text-[10.5px] text-[var(--gray-8)]">
          Lower = more deterministic; higher = more creative.
        </p>
      </Field>

      <Field label="Max tokens">
        <input
          type="number"
          min={1}
          max={32768}
          step={256}
          value={maxTokens}
          onChange={(e) =>
            update({ maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          placeholder="1024"
          className={inputClass}
        />
      </Field>
    </div>
  );
}
