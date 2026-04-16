'use client';

import { LuEye } from 'react-icons/lu';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass } from '../shared/primitives';

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

  const update = (patch: Partial<PixelOptions>) => {
    onBlockChange({ ...block, options: { ...opts, ...patch } });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuEye} title="Meta Pixel" />

      <Field label="Pixel ID">
        <input
          type="text"
          value={opts.pixelId ?? ''}
          onChange={(e) => update({ pixelId: e.target.value })}
          placeholder="123456789012345"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Event Type">
        <select
          value={eventType}
          onChange={(e) => update({ eventType: e.target.value as PixelEventType })}
          className={selectClass}
        >
          <option value="PageView">PageView</option>
          <option value="Lead">Lead</option>
          <option value="Purchase">Purchase</option>
          <option value="CompleteRegistration">CompleteRegistration</option>
          <option value="Contact">Contact</option>
          <option value="InitiateCheckout">InitiateCheckout</option>
          <option value="ViewContent">ViewContent</option>
          <option value="AddToCart">AddToCart</option>
          <option value="AddToWishlist">AddToWishlist</option>
          <option value="CustomEvent">CustomEvent</option>
        </select>
      </Field>

      {isCustomEvent && (
        <Field label="Custom Event Name">
          <input
            type="text"
            value={opts.customEventName ?? ''}
            onChange={(e) => update({ customEventName: e.target.value })}
            placeholder="MyCustomEvent"
            className={inputClass}
            spellCheck={false}
          />
        </Field>
      )}
    </div>
  );
}
