'use client';

import { useCallback } from 'react';
import { Cpu } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Textarea, Slider } from '@/components/sabcrm/20ui';
import { PanelHeader, Divider } from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface TogetherAIOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  responseVariableId?: string;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function TogetherAISettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as TogetherAIOptions;
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 1024;

  const update = useCallback(
    (patch: Partial<TogetherAIOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={Cpu} title="Together AI" />

      <Field label="API Key" help="Stored in the flow settings. Never exposed to end-users.">
        <Input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="together-..."
          autoComplete="off"
          aria-label="API key"
        />
      </Field>

      <Field
        label="Model"
        help="Enter the full Together AI model slug, e.g. mistralai/Mixtral-8x7B-Instruct-v0.1."
      >
        <Input
          type="text"
          value={opts.model ?? ''}
          onChange={(e) => update({ model: e.target.value })}
          placeholder="meta-llama/Llama-3-70b-chat-hf"
          aria-label="Model"
        />
      </Field>

      <Divider />

      <Field label="System prompt">
        <Textarea
          value={opts.systemPrompt ?? ''}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant."
          rows={4}
          spellCheck
          aria-label="System prompt"
          className="resize-y min-h-[80px]"
        />
      </Field>

      <Field label="Save response to">
        <VariableSelect
          variables={variables}
          value={opts.responseVariableId}
          onChange={(id) => update({ responseVariableId: id })}
          placeholder="Select variable"
        />
      </Field>

      <Divider />

      <Field
        label={`Temperature: ${temperature.toFixed(1)}`}
        help="Lower is more deterministic, higher is more creative."
      >
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onValueChange={(v) => update({ temperature: Array.isArray(v) ? v[0] : v })}
          ariaLabel="Temperature"
        />
      </Field>

      <Field label="Max tokens">
        <Input
          type="number"
          min={1}
          max={32768}
          step={256}
          value={maxTokens}
          onChange={(e) =>
            update({ maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })
          }
          placeholder="1024"
          aria-label="Max tokens"
        />
      </Field>
    </div>
  );
}
