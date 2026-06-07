'use client';

import { useCallback } from 'react';
import { Eye } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

/* ── Types ─────────────────────────────────────────────────── */

type PixelEventType =
  | 'PageView'
  | 'Lead'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'Contact'
  | 'InitiateCheckout'
  | 'ViewContent'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'CustomEvent';

interface PixelOptions {
  pixelId?: string;
  eventType?: PixelEventType;
  customEventName?: string;
}

/* ── Event options ─────────────────────────────────────────── */

const EVENT_TYPES: PixelEventType[] = [
  'PageView',
  'Lead',
  'Purchase',
  'CompleteRegistration',
  'Contact',
  'InitiateCheckout',
  'ViewContent',
  'AddToCart',
  'AddToWishlist',
  'CustomEvent',
];

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Component ─────────────────────────────────────────────── */

export function PixelSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as PixelOptions;
  const eventType: PixelEventType = (opts.eventType as PixelEventType) ?? 'PageView';
  const isCustomEvent = eventType === 'CustomEvent';

  const update = useCallback(
    (patch: Partial<PixelOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  return (
    <div className="space-y-4">
      <PageHeader compact bordered={false}>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <Eye
              size={16}
              strokeWidth={1.8}
              className="text-[var(--st-text-secondary)]"
              aria-hidden="true"
            />
            Meta Pixel
          </PageTitle>
        </PageHeaderHeading>
      </PageHeader>

      <Field label="Pixel ID">
        <Input
          type="text"
          value={opts.pixelId ?? ''}
          onChange={(e) => update({ pixelId: e.target.value })}
          placeholder="123456789012345"
          spellCheck={false}
          aria-label="Pixel ID"
        />
      </Field>

      <Field label="Event type">
        <Select
          value={eventType}
          onValueChange={(v) => update({ eventType: v as PixelEventType })}
        >
          <SelectTrigger aria-label="Event type">
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isCustomEvent && (
        <Field label="Custom event name">
          <Input
            type="text"
            value={opts.customEventName ?? ''}
            onChange={(e) => update({ customEventName: e.target.value })}
            placeholder="MyCustomEvent"
            spellCheck={false}
            aria-label="Custom event name"
          />
        </Field>
      )}
    </div>
  );
}
