'use client';

import { LuClock, LuBraces } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, PanelHeader } from './shared/primitives';

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

export function WaitSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const unit: DurationUnit = (options.unit as DurationUnit) ?? 'seconds';
  const duration = typeof options.duration === 'number' ? options.duration : 2;

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const maxSlider = unit === 'seconds' ? 300 : unit === 'minutes' ? 120 : 48;

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuClock} title="Wait" />

      {/* Unit selector */}
      <Field label="Unit">
        <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-0.5">
          {(['seconds', 'minutes', 'hours'] as DurationUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => update({ unit: u, duration: 1 })}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
                unit === u
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </Field>

      {/* Duration control */}
      <Field label={`Duration (${unit})`}>
        {/* Quick-pick presets */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_SECONDS[unit].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => update({ duration: preset })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                duration === preset
                  ? 'border-[#f76808]/50 bg-[#f76808]/10 text-[#f76808]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Slider + numeric input */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={maxSlider}
            step={1}
            value={duration}
            onChange={(e) => update({ duration: Number(e.target.value) })}
            className="flex-1 accent-[#f76808]"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={0}
              max={maxSlider * 10}
              step={1}
              value={duration}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              className="w-[70px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1.5 text-[13px] text-center text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors"
            />
            <span className="text-[12px] text-[var(--gray-9)]">
              {unit.slice(0, 3)}
            </span>
          </div>
        </div>
      </Field>

      {/* Optional waiting message */}
      <Field label="Waiting message (optional)">
        <div className="relative flex items-center">
          <input
            type="text"
            value={typeof options.waitingMessage === 'string' ? options.waitingMessage : ''}
            onChange={(e) => update({ waitingMessage: e.target.value })}
            placeholder="Please wait… or {{customMessage}}"
            className={cn(
              'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px]',
              'text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors pr-8',
            )}
          />
          <LuBraces
            className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
        </div>
        <p className="text-[11px] text-[var(--gray-8)] mt-1">
          Shown to the user while waiting. Leave empty to wait silently.
        </p>
      </Field>
    </div>
  );
}
