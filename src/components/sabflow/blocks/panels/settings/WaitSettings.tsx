'use client';
import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import { cn } from '@/lib/utils';

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

const PRESET_DURATIONS = [1, 2, 5, 10, 30, 60];

export function WaitSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const seconds = Number(options.seconds ?? 2);

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Duration (seconds)">
        {/* Quick-pick presets */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PRESET_DURATIONS.map((s) => (
            <button
              key={s}
              onClick={() => update({ seconds: s })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                seconds === s
                  ? 'border-[#f76808]/50 bg-[#f76808]/10 text-[#f76808]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {s >= 60 ? `${s / 60}m` : `${s}s`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={seconds}
            onChange={(e) => update({ seconds: Number(e.target.value) })}
            className="flex-1 accent-[#f76808]"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={3600}
              step={1}
              value={seconds}
              onChange={(e) => update({ seconds: Number(e.target.value) })}
              className="w-[70px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1.5 text-[13px] text-center text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors"
            />
            <span className="text-[12px] text-[var(--gray-9)]">sec</span>
          </div>
        </div>
      </Field>

      <Field label="Waiting message (optional)">
        <VariableInput
          value={String(options.waitingMessage ?? '')}
          onChange={(waitingMessage) => update({ waitingMessage })}
          placeholder="Please wait… {{seconds}} seconds"
          variables={variables}
        />
        <p className="text-[11px] text-[var(--gray-8)] mt-1">
          Shown to the user while the bot is waiting.
          Leave empty to wait silently.
        </p>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
