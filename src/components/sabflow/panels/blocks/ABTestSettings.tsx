'use client';

import { LuFlaskConical } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { PanelHeader } from './shared/primitives';

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
      <PanelHeader icon={LuFlaskConical} title="A/B Test" />

      {/* Visual split bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          <span>Split</span>
          <span className="font-mono text-[var(--gray-11)]">
            A&nbsp;{aPercent}% / B&nbsp;{bPercent}%
          </span>
        </div>

        {/* Segmented bar */}
        <div className="relative h-5 w-full overflow-hidden rounded-full bg-[var(--gray-3)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
            style={{ width: `${aPercent}%`, background: '#f76808' }}
          />
        </div>

        {/* Range slider */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={aPercent}
          onChange={(e) => update({ aPercent: Number(e.target.value) })}
          className="w-full accent-[#f76808]"
          aria-label="A branch percentage"
        />
      </div>

      {/* Numeric inputs */}
      <div className="flex gap-3">
        <PercentField
          label="A branch"
          value={aPercent}
          onChange={(v) => update({ aPercent: Math.min(100, Math.max(0, v)) })}
          accent="#f76808"
        />
        <PercentField
          label="B branch"
          value={bPercent}
          onChange={(v) => update({ aPercent: Math.min(100, Math.max(0, 100 - v)) })}
          accent="var(--gray-9)"
        />
      </div>

      <p className="text-[11px] text-[var(--gray-8)] leading-relaxed">
        Users are randomly routed to branch A or B at the configured ratio.
        The two output handles on the canvas represent branch A and B.
      </p>
    </div>
  );
}

/* ── Percent field helper ───────────────────────────────────── */
function PercentField({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}) {
  return (
    <div className="flex-1 space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-center text-[var(--gray-12)] outline-none transition-colors"
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
          onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
          onBlur={(e) => (e.currentTarget.style.borderColor = '')}
        />
        <span className="text-[12px] text-[var(--gray-9)] shrink-0">%</span>
      </div>
    </div>
  );
}
