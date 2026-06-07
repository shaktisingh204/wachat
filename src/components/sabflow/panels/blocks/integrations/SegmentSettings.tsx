'use client';

import { useCallback } from 'react';
import { Activity, Plus, Trash2 } from 'lucide-react';
import type { Block } from '@/lib/sabflow/types';
import { Field, Input, Button, IconButton } from '@/components/sabcrm/20ui';
import { PanelHeader } from '../shared/primitives';

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
      <PanelHeader icon={Activity} title="Segment" />

      <Field label="Write Key">
        <Input
          type="text"
          value={opts.writeKey ?? ''}
          onChange={(e) => update({ writeKey: e.target.value })}
          placeholder="your-segment-write-key"
          spellCheck={false}
          aria-label="Write key"
        />
      </Field>

      <Field label="Event Name">
        <Input
          type="text"
          value={opts.eventName ?? ''}
          onChange={(e) => update({ eventName: e.target.value })}
          placeholder="Button Clicked or {{eventName}}"
          spellCheck={false}
          aria-label="Event name"
        />
      </Field>

      <Field label="Properties">
        <div className="space-y-2">
          {properties.map((prop) => (
            <div key={prop.id} className="flex items-center gap-2">
              <Input
                type="text"
                value={prop.key}
                onChange={(e) => updateProperty(prop.id, 'key', e.target.value)}
                placeholder="Key"
                spellCheck={false}
                aria-label="Property key"
                className="flex-1"
              />
              <Input
                type="text"
                value={prop.value}
                onChange={(e) => updateProperty(prop.id, 'value', e.target.value)}
                placeholder="Value or {{var}}"
                spellCheck={false}
                aria-label="Property value"
                className="flex-1"
              />
              <IconButton
                label="Remove property"
                icon={Trash2}
                variant="ghost"
                size="sm"
                onClick={() => removeProperty(prop.id)}
                className="shrink-0"
              />
            </div>
          ))}

          <Button variant="outline" size="sm" block iconLeft={Plus} onClick={addProperty}>
            Add property
          </Button>
        </div>
      </Field>
    </div>
  );
}
