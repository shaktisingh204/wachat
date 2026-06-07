'use client';

import { useCallback } from 'react';
import { ChartBar } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Separator,
} from '@/components/sabcrm/20ui';

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
      <PageHeader compact bordered={false}>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <ChartBar
              size={16}
              strokeWidth={1.8}
              className="text-[var(--st-text-secondary)]"
              aria-hidden="true"
            />
            Google Analytics
          </PageTitle>
        </PageHeaderHeading>
      </PageHeader>

      <Field
        label="Tracking ID"
        help={
          <>
            Your GA4 Measurement ID (starts with{' '}
            <span className="font-mono text-[var(--st-text)]">G-</span>).
          </>
        }
      >
        <Input
          type="text"
          value={opts.trackingId ?? ''}
          onChange={(e) => update({ trackingId: e.target.value })}
          placeholder="G-XXXXXXXXXX"
          spellCheck={false}
        />
      </Field>

      <Separator />

      <Field label="Event action">
        <Input
          type="text"
          value={opts.eventAction ?? ''}
          onChange={(e) => update({ eventAction: e.target.value })}
          placeholder="e.g. button_click"
          spellCheck={false}
        />
      </Field>

      <Field label="Event category">
        <Input
          type="text"
          value={opts.eventCategory ?? ''}
          onChange={(e) => update({ eventCategory: e.target.value })}
          placeholder="e.g. engagement"
          spellCheck={false}
        />
      </Field>

      <Field label="Event label">
        <Input
          type="text"
          value={opts.eventLabel ?? ''}
          onChange={(e) => update({ eventLabel: e.target.value })}
          placeholder="e.g. hero_cta"
          spellCheck={false}
        />
      </Field>

      <Field
        label="Event value"
        help={
          <>
            Use{' '}
            <span className="font-mono text-[var(--st-text)]">{'{{variable}}'}</span>{' '}
            to pass a dynamic value.
          </>
        }
      >
        <Input
          type="text"
          value={opts.eventValue ?? ''}
          onChange={(e) => update({ eventValue: e.target.value })}
          placeholder="e.g. {{score}} or a static number"
          spellCheck={false}
        />
      </Field>
    </div>
  );
}
