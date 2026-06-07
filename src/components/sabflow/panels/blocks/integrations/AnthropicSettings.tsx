'use client';

import { useCallback } from 'react';
import { Brain } from 'lucide-react';
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

const MESSAGE_FORMAT_HINTS: Record<UserMessagesFormat, string> = {
  last: 'Sends only the most recent user message.',
  all: 'Sends the full conversation history as the user turn.',
};

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
  const userMessagesFormat: UserMessagesFormat = opts.userMessagesFormat ?? 'last';
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
      <PanelHeader icon={Brain} title="Anthropic" />

      <Field label="API Key" help="Stored in the flow settings. Never exposed to end-users.">
        <Input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="sk-ant-api03-..."
          autoComplete="off"
          aria-label="API key"
        />
      </Field>

      <Field label="Model">
        <Select value={model} onValueChange={(v) => update({ model: v as AnthropicModel })}>
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

      <Field label="User messages format" help={MESSAGE_FORMAT_HINTS[userMessagesFormat]}>
        <Select
          value={userMessagesFormat}
          onValueChange={(v) => update({ userMessagesFormat: v as UserMessagesFormat })}
        >
          <SelectTrigger aria-label="User messages format">
            <SelectValue placeholder="Select a format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last">Last message only</SelectItem>
            <SelectItem value="all">All messages</SelectItem>
          </SelectContent>
        </Select>
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
          max={200000}
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
