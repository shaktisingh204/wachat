'use client';

import { Clock, Braces } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Slider, SegmentedControl, Button } from '@/components/sabcrm/20ui';
import { PanelHeader } from './shared/primitives';

type DurationUnit = 'seconds' | 'minutes' | 'hours';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

const PRESET_SECONDS: Record<DurationUnit, number[]> = {
  seconds: [1, 2, 5, 10, 30],
  minutes: [1, 2, 5, 10, 30],
  hours: [1, 2, 6, 12, 24],
};

const UNIT_ITEMS: { value: DurationUnit; label: string }[] = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
];

export function WaitSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const unit: DurationUnit = (options.unit as DurationUnit) ?? 'seconds';
  const duration = typeof options.duration === 'number' ? options.duration : 2;

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const maxSlider = unit === 'seconds' ? 300 : unit === 'minutes' ? 120 : 48;
  const waitingMessage = typeof options.waitingMessage === 'string' ? options.waitingMessage : '';

  return (
    <div className="space-y-4">
      <PanelHeader icon={Clock} title="Wait" />

      {/* Unit selector */}
      <Field label="Unit">
        <SegmentedControl<DurationUnit>
          items={UNIT_ITEMS}
          value={unit}
          onChange={(next) => update({ unit: next, duration: 1 })}
          fullWidth
          aria-label="Duration unit"
        />
      </Field>

      {/* Duration control */}
      <Field label={`Duration (${unit})`}>
        {/* Quick-pick presets */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESET_SECONDS[unit].map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={duration === preset ? 'primary' : 'secondary'}
              onClick={() => update({ duration: preset })}
            >
              {preset}
            </Button>
          ))}
        </div>

        {/* Slider + numeric input */}
        <div className="flex items-center gap-3">
          <Slider
            className="flex-1"
            min={0}
            max={maxSlider}
            step={1}
            value={duration}
            onValueChange={(next) =>
              update({ duration: Array.isArray(next) ? next[0] : next })
            }
            ariaLabel={`Duration in ${unit}`}
          />
          <div className="flex shrink-0 items-center gap-1">
            <Input
              type="number"
              min={0}
              max={maxSlider * 10}
              step={1}
              value={duration}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              className="w-[70px] text-center"
              aria-label={`Duration value in ${unit}`}
            />
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              {unit.slice(0, 3)}
            </span>
          </div>
        </div>
      </Field>

      {/* Optional waiting message */}
      <Field
        label="Waiting message (optional)"
        help="Shown to the user while waiting. Leave empty to wait silently."
      >
        <Input
          type="text"
          value={waitingMessage}
          onChange={(e) => update({ waitingMessage: e.target.value })}
          placeholder="Please wait, or {{customMessage}}"
          iconRight={Braces}
        />
      </Field>
    </div>
  );
}
