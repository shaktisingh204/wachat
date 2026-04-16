'use client';

import { useCallback } from 'react';
import { LuChartBar } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, Divider } from '../shared/primitives';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface GoogleAnalyticsOptions {
  trackingId?: string;
  eventAction?: string;
  eventCategory?: string;
  eventLabel?: string;
  eventValue?: string;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function GoogleAnalyticsSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as GoogleAnalyticsOptions;

  const update = useCallback(
    (patch: Partial<GoogleAnalyticsOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuChartBar} title="Google Analytics" />

      <Field label="Tracking ID">
        <input
          type="text"
          value={opts.trackingId ?? ''}
          onChange={(e) => update({ trackingId: e.target.value })}
          placeholder="G-XXXXXXXXXX"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Your GA4 Measurement ID (starts with{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">G-</code>).
        </p>
      </Field>

      <Divider />

      <Field label="Event action">
        <input
          type="text"
          value={opts.eventAction ?? ''}
          onChange={(e) => update({ eventAction: e.target.value })}
          placeholder="e.g. button_click"
          className={inputClass}
        />
      </Field>

      <Field label="Event category">
        <input
          type="text"
          value={opts.eventCategory ?? ''}
          onChange={(e) => update({ eventCategory: e.target.value })}
          placeholder="e.g. engagement"
          className={inputClass}
        />
      </Field>

      <Field label="Event label">
        <input
          type="text"
          value={opts.eventLabel ?? ''}
          onChange={(e) => update({ eventLabel: e.target.value })}
          placeholder="e.g. hero_cta"
          className={inputClass}
        />
      </Field>

      <Field label="Event value">
        <input
          type="text"
          value={opts.eventValue ?? ''}
          onChange={(e) => update({ eventValue: e.target.value })}
          placeholder="e.g. {{score}} or a static number"
          className={inputClass}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Use{' '}
          <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
            {'{{variable}}'}
          </code>{' '}
          to pass a dynamic value.
        </p>
      </Field>
    </div>
  );
}
