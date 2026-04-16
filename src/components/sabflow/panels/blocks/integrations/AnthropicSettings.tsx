'use client';

import { useCallback } from 'react';
import { LuBrain } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

/* ── Types ───────────────────────────────────────────────────────────────── */

type AnthropicModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

type UserMessagesFormat = 'last' | 'all';

interface AnthropicOptions {
  apiKey?: string;
  model?: AnthropicModel;
  systemPrompt?: string;
  userMessagesFormat?: UserMessagesFormat;
  maxTokens?: number;
  temperature?: number;
  responseVariableId?: string;
}

/* ── Model options ───────────────────────────────────────────────────────── */

const MODELS: { value: AnthropicModel; label: string }[] = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function AnthropicSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as AnthropicOptions;
  const model: AnthropicModel = opts.model ?? 'claude-sonnet-4-6';
  const temperature = opts.temperature ?? 1;
  const maxTokens = opts.maxTokens ?? 1024;

  const update = useCallback(
    (patch: Partial<AnthropicOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuBrain} title="Anthropic" />

      <Field label="API Key">
        <input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="sk-ant-api03-…"
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
          onChange={(e) => update({ model: e.target.value as AnthropicModel })}
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

      <Field label="User messages format">
        <select
          value={opts.userMessagesFormat ?? 'last'}
          onChange={(e) => update({ userMessagesFormat: e.target.value as UserMessagesFormat })}
          className={selectClass}
        >
          <option value="last">Last message only</option>
          <option value="all">All messages</option>
        </select>
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          "All messages" sends the full conversation history as the user turn.
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
          max={200000}
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
