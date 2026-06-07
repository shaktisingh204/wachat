'use client';

import { Calendar } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Field,
  Input,
} from '@/components/sabcrm/20ui';

/* ── Types ─────────────────────────────────────────────────── */

interface CalComOptions {
  calLink?: string;
  calClientId?: string;
}

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function CalComSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as CalComOptions;

  const update = (patch: Partial<CalComOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PageHeader compact>
        <PageHeaderHeading>
          <span className="inline-flex items-center gap-2">
            <Calendar size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
            <PageTitle>Cal.com</PageTitle>
          </span>
        </PageHeaderHeading>
      </PageHeader>

      <Field
        label="Cal.com Link"
        help={
          <>
            Enter the path after{' '}
            <span className="font-mono text-[var(--st-text)]">cal.com/</span>, e.g.{' '}
            <span className="font-mono text-[var(--st-text)]">john/30min</span>
          </>
        }
      >
        <Input
          type="text"
          value={opts.calLink ?? ''}
          onChange={(e) => update({ calLink: e.target.value })}
          placeholder="username/event-type"
          spellCheck={false}
        />
      </Field>

      <Field label="Cal.com Client ID (optional)">
        <Input
          type="text"
          value={opts.calClientId ?? ''}
          onChange={(e) => update({ calClientId: e.target.value })}
          placeholder="Optional, required for Cal.com Platform"
          spellCheck={false}
        />
      </Field>
    </div>
  );
}
