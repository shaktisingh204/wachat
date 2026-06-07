'use client';

import { useCallback } from 'react';
import { Bot } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Slider,
} from '@/components/sabcrm/20ui';
import { PanelHeader, Divider } from '../shared/primitives';
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
      <PanelHeader icon={Bot} title="Mistral AI" />

      <Field label="API Key" help="Stored in the flow settings. Never exposed to end-users.">
        <Input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="Paste your Mistral API key"
          autoComplete="off"
          aria-label="API key"
        />
      </Field>

      <Field label="Model">
        <Select value={model} onValueChange={(v) => update({ model: v as MistralModel })}>
          <SelectTrigger aria-label="Model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
