'use client';

import { Volume2 } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from '../shared/primitives';

/* ── Types ─────────────────────────────────────────────────── */

type ElevenLabsModel =
  | 'eleven_monolingual_v1'
  | 'eleven_multilingual_v2'
  | 'eleven_turbo_v2';

interface ElevenLabsOptions {
  apiKey?: string;
  voiceId?: string;
  modelId?: ElevenLabsModel;
  textToSpeak?: string;
}

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function ElevenLabsSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as ElevenLabsOptions;

  const update = (patch: Partial<ElevenLabsOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={Volume2} title="ElevenLabs" />

      <Field label="API Key" help="Stored in the flow settings. Never exposed to end-users.">
        <Input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="sk_xxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field label="Voice ID" help="Find voice IDs in your ElevenLabs voice library.">
        <Input
          type="text"
          value={opts.voiceId ?? ''}
          onChange={(e) => update({ voiceId: e.target.value })}
          placeholder="21m00Tcm4TlvDq8ikWAM"
          spellCheck={false}
        />
      </Field>

      <Field label="Model ID">
        <Select
          value={opts.modelId ?? 'eleven_monolingual_v1'}
          onValueChange={(v) => update({ modelId: v as ElevenLabsModel })}
        >
          <SelectTrigger aria-label="Model ID">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eleven_monolingual_v1">Monolingual v1</SelectItem>
            <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
            <SelectItem value="eleven_turbo_v2">Turbo v2</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Text to Speak"
        help={
          <>
            Use{' '}
            <code className="font-mono text-[var(--st-text)]">{'{{variable}}'}</code>
            {' '}to inject dynamic values.
          </>
        }
      >
        <Textarea
          value={opts.textToSpeak ?? ''}
          onChange={(e) => update({ textToSpeak: e.target.value })}
          placeholder="Hello {{name}}, welcome to {{company}}!"
          rows={4}
          className="resize-y min-h-[80px]"
          spellCheck={false}
        />
      </Field>
    </div>
  );
}
