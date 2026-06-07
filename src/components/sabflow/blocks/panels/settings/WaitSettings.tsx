'use client';

import type { Block } from '@/lib/sabflow/types';
import { VariableInput } from '../VariableInput';
import { Field, Input, Button, Slider } from '@/components/sabcrm/20ui';

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
            <Button
              key={s}
              size="sm"
              variant={seconds === s ? 'primary' : 'secondary'}
              onClick={() => update({ seconds: s })}
            >
              {s >= 60 ? `${s / 60}m` : `${s}s`}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Slider
            className="flex-1"
            min={0}
            max={300}
            step={1}
            value={seconds}
            onValueChange={(value) =>
              update({ seconds: Array.isArray(value) ? value[0] : value })
            }
            ariaLabel="Wait duration in seconds"
          />
          <div className="flex items-center gap-1">
            <Input
              id="wait-seconds"
              type="number"
              inputSize="sm"
              min={0}
              max={3600}
              step={1}
              value={seconds}
              onChange={(e) => update({ seconds: Number(e.target.value) })}
              aria-label="Wait duration in seconds"
              className="w-[70px] text-center"
            />
            <span className="text-[12px] text-[var(--st-text-secondary)]">sec</span>
          </div>
        </div>
      </Field>

      <Field
        label="Waiting message (optional)"
        help="Shown to the user while the bot is waiting. Leave empty to wait silently."
      >
        <VariableInput
          value={String(options.waitingMessage ?? '')}
          onChange={(waitingMessage) => update({ waitingMessage })}
          placeholder="Please wait, {{seconds}} seconds"
          variables={variables}
        />
      </Field>
    </div>
  );
}
