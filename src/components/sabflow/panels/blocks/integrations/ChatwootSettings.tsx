'use client';

import { MessageCircle } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

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
      <PageHeader compact bordered={false}>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <MessageCircle
              size={16}
              strokeWidth={1.8}
              className="text-[var(--st-text-secondary)]"
              aria-hidden="true"
            />
            Chatwoot
          </PageTitle>
        </PageHeaderHeading>
      </PageHeader>

      <Field label="Account ID">
        <Input
          type="text"
          value={opts.accountId ?? ''}
          onChange={(e) => update({ accountId: e.target.value })}
          placeholder="123456"
          spellCheck={false}
        />
      </Field>

      <Field label="Website Token">
        <Input
          type="text"
          value={opts.websiteToken ?? ''}
          onChange={(e) => update({ websiteToken: e.target.value })}
          placeholder="your-website-token"
          spellCheck={false}
        />
      </Field>

      <Field
        label="API URL"
        help={
          <>
            Leave blank to use the default{' '}
            <span className="font-mono text-[var(--st-text)]">https://app.chatwoot.com</span>
          </>
        }
      >
        <Input
          type="url"
          value={opts.apiUrl ?? ''}
          onChange={(e) => update({ apiUrl: e.target.value })}
          placeholder="https://app.chatwoot.com"
          spellCheck={false}
        />
      </Field>
    </div>
  );
}
