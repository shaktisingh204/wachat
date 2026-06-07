'use client';

import { FlaskConical } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, Input, Slider } from '@/components/sabcrm/20ui';

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/** Default A percentage when not yet configured */
const DEFAULT_A_PERCENT = 50;

export function ABTestSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const options = block.options ?? {};
  const aPercent = typeof options.aPercent === 'number' ? options.aPercent : DEFAULT_A_PERCENT;
  const bPercent = 100 - aPercent;

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      {/* Block header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--st-border)]">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
          <FlaskConical className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="text-[12px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide">
          A/B Test
        </span>
      </div>

      {/* Visual split bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          <span>Split</span>
          <span className="font-mono text-[var(--st-text)]">
            A&nbsp;{aPercent}% / B&nbsp;{bPercent}%
          </span>
        </div>

        {/* Segmented bar */}
        <div className="relative h-5 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--st-accent)] transition-all duration-150"
            style={{ width: `${aPercent}%` }}
          />
        </div>

        {/* Range slider */}
        <Slider
          min={0}
          max={100}
          step={1}
          value={aPercent}
          onValueChange={(v) => update({ aPercent: Number(Array.isArray(v) ? v[0] : v) })}
          ariaLabel="A branch percentage"
        />
      </div>

      {/* Numeric inputs */}
      <div className="flex gap-3">
        <PercentField
          label="A branch"
          value={aPercent}
          onChange={(v) => update({ aPercent: Math.min(100, Math.max(0, v)) })}
        />
        <PercentField
          label="B branch"
          value={bPercent}
          onChange={(v) => update({ aPercent: Math.min(100, Math.max(0, 100 - v)) })}
        />
      </div>

      <p className="text-[11px] text-[var(--st-text-tertiary)] leading-relaxed">
        Users are randomly routed to branch A or B at the configured ratio.
        The two output handles on the canvas represent branch A and B.
      </p>
    </div>
  );
}

/* Percent field helper */
function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex-1">
      <Field label={label}>
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          suffix="%"
        />
      </Field>
    </div>
  );
}
