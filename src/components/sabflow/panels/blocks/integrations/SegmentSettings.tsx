'use client';

import { useCallback } from 'react';
import { LuActivity, LuPlus, LuTrash2 } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass } from '../shared/primitives';

/* ── Types ─────────────────────────────────────────────────── */

interface SegmentProperty {
  id: string;
  key: string;
  value: string;
}

interface SegmentOptions {
  writeKey?: string;
  eventName?: string;
  properties?: SegmentProperty[];
}

/* ── Props ─────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
};

/* ── Helpers ────────────────────────────────────────────────── */

function makeProp(): SegmentProperty {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

/* ── Component ─────────────────────────────────────────────── */

export function SegmentSettings({ block, onBlockChange }: Props) {
  const opts = (block.options ?? {}) as SegmentOptions;
  const properties: SegmentProperty[] = Array.isArray(opts.properties) ? opts.properties : [];

  const update = useCallback(
    (patch: Partial<SegmentOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const updateProperties = (updated: SegmentProperty[]) => update({ properties: updated });

  const addProperty = () => updateProperties([...properties, makeProp()]);

  const updateProperty = (id: string, field: 'key' | 'value', val: string) =>
    updateProperties(
      properties.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    );

  const removeProperty = (id: string) =>
    updateProperties(properties.filter((p) => p.id !== id));

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuActivity} title="Segment" />

      <Field label="Write Key">
        <input
          type="text"
          value={opts.writeKey ?? ''}
          onChange={(e) => update({ writeKey: e.target.value })}
          placeholder="your-segment-write-key"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Event Name">
        <input
          type="text"
          value={opts.eventName ?? ''}
          onChange={(e) => update({ eventName: e.target.value })}
          placeholder="Button Clicked or {{eventName}}"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Field label="Properties">
        <div className="space-y-2">
          {properties.map((prop) => (
            <div key={prop.id} className="flex gap-2 items-center">
              <input
                type="text"
                value={prop.key}
                onChange={(e) => updateProperty(prop.id, 'key', e.target.value)}
                placeholder="Key"
                className={cn(inputClass, 'flex-1')}
                spellCheck={false}
              />
              <input
                type="text"
                value={prop.value}
                onChange={(e) => updateProperty(prop.id, 'value', e.target.value)}
                placeholder="Value or {{var}}"
                className={cn(inputClass, 'flex-1')}
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => removeProperty(prop.id)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 hover:bg-[var(--gray-3)] transition-colors"
                aria-label="Remove property"
              >
                <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addProperty}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-lg',
              'border border-dashed border-[var(--gray-6)] py-1.5',
              'text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              'hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)]',
              'transition-colors',
            )}
          >
            <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Add property
          </button>
        </div>
      </Field>
    </div>
  );
}
