'use client';

import { LuCalendar } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass } from '../shared/primitives';

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
      <PanelHeader icon={LuCalendar} title="Cal.com" />

      <Field label="Cal.com Link">
        <input
          type="text"
          value={opts.calLink ?? ''}
          onChange={(e) => update({ calLink: e.target.value })}
          placeholder="username/event-type"
          className={inputClass}
          spellCheck={false}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Enter the path after{' '}
          <span className="font-mono text-[var(--gray-10)]">cal.com/</span>, e.g.{' '}
          <span className="font-mono text-[var(--gray-10)]">john/30min</span>
        </p>
      </Field>

      <Field label="Cal.com Client ID (optional)">
        <input
          type="text"
          value={opts.calClientId ?? ''}
          onChange={(e) => update({ calClientId: e.target.value })}
          placeholder="Optional — required for Cal.com Platform"
          className={inputClass}
          spellCheck={false}
        />
      </Field>
    </div>
  );
}
