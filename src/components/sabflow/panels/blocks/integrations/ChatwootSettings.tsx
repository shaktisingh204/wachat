'use client';

import { LuMessageCircle } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass } from '../shared/primitives';

/* ── Types ─────────────────────────────────────────────────── */

interface ChatwootOptions {
  accountId?: string;
  websiteToken?: string;
  apiUrl?: string;
}

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function ChatwootSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as ChatwootOptions;

  const update = (patch: Partial<ChatwootOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuMessageCircle} title="Chatwoot" />

      <Field label="Account ID">
        <input
          type="text"
          value={opts.accountId ?? ''}
          onChange={(e) => update({ accountId: e.target.value })}
          placeholder="123456"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Website Token">
        <input
          type="text"
          value={opts.websiteToken ?? ''}
          onChange={(e) => update({ websiteToken: e.target.value })}
          placeholder="your-website-token"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="API URL">
        <input
          type="url"
          value={opts.apiUrl ?? ''}
          onChange={(e) => update({ apiUrl: e.target.value })}
          placeholder="https://app.chatwoot.com"
          className={inputClass}
          spellCheck={false}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Leave blank to use the default{' '}
          <span className="font-mono text-[var(--gray-10)]">https://app.chatwoot.com</span>
        </p>
      </Field>
    </div>
  );
}
