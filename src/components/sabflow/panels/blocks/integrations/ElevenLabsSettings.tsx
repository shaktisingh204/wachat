'use client';

import { LuVolume2 } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass } from '../shared/primitives';

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
      <PanelHeader icon={LuVolume2} title="ElevenLabs" />

      <Field label="API Key">
        <input
          type="password"
          value={opts.apiKey ?? ''}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="sk_xxxxxxxxxxxxxxxxxxxx"
          className={inputClass}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <Field label="Voice ID">
        <input
          type="text"
          value={opts.voiceId ?? ''}
          onChange={(e) => update({ voiceId: e.target.value })}
          placeholder="21m00Tcm4TlvDq8ikWAM"
          className={inputClass}
          spellCheck={false}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Find voice IDs in your ElevenLabs voice library.
        </p>
      </Field>

      <Field label="Model ID">
        <select
          value={opts.modelId ?? 'eleven_monolingual_v1'}
          onChange={(e) => update({ modelId: e.target.value as ElevenLabsModel })}
          className={selectClass}
        >
          <option value="eleven_monolingual_v1">Monolingual v1</option>
          <option value="eleven_multilingual_v2">Multilingual v2</option>
          <option value="eleven_turbo_v2">Turbo v2</option>
        </select>
      </Field>

      <Field label="Text to Speak">
        <textarea
          value={opts.textToSpeak ?? ''}
          onChange={(e) => update({ textToSpeak: e.target.value })}
          placeholder="Hello {{name}}, welcome to {{company}}!"
          rows={4}
          className={cn(inputClass, 'resize-y min-h-[80px]')}
          spellCheck={false}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Use{' '}
          <span className="font-mono text-[#f76808]">{'{{variable}}'}</span>
          {' '}to inject dynamic values.
        </p>
      </Field>
    </div>
  );
}
