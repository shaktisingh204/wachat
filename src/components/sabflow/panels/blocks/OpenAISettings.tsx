'use client';

import { useCallback } from 'react';
import { LuSparkles } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ───────────────────────────────────────────────────────────────── */

type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo';

interface OpenAIOptions {
  model?: OpenAIModel;
  systemPrompt?: string;
  userMessage?: string;
  responseVariableId?: string;
  temperature?: number;
  maxTokens?: number;
}

/* ── Model options ───────────────────────────────────────────────────────── */

const MODELS: { value: OpenAIModel; label: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function OpenAISettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as OpenAIOptions;
  const model: OpenAIModel = opts.model ?? 'gpt-4o';
  const temperature = opts.temperature ?? 1;
  const maxTokens = opts.maxTokens ?? 1024;

  const update = useCallback(
    (patch: Partial<OpenAIOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuSparkles} title="OpenAI" />

      <Field label="Model">
        <select
          value={model}
          onChange={(e) => update({ model: e.target.value as OpenAIModel })}
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

      <Field label="User message">
        <textarea
          value={opts.userMessage ?? ''}
          onChange={(e) => update({ userMessage: e.target.value })}
          placeholder="{{userInput}} or a static prompt"
          rows={3}
          spellCheck={false}
          className={`${inputClass} resize-y min-h-[60px]`}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Use{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>{' '}
          to reference collected values.
        </p>
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

      {/* Temperature */}
      <Field label={`Temperature — ${temperature.toFixed(1)}`}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0">0</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
            className="flex-1 accent-[#f76808]"
          />
          <span className="text-[11px] text-[var(--gray-8)] w-5 shrink-0 text-right">2</span>
        </div>
        <p className="text-[10.5px] text-[var(--gray-8)]">
          Lower = more deterministic; higher = more creative.
        </p>
      </Field>

      <Field label="Max tokens">
        <input
          type="number"
          min={1}
          max={128000}
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
