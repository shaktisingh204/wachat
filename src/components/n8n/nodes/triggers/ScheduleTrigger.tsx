'use client';

import { useState } from 'react';
import { LuClock, LuCalendarClock, LuChevronDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type ScheduleMode = 'interval' | 'cron';

export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface ScheduleTriggerConfig {
  mode: ScheduleMode;
  /** Only used when mode === 'interval' */
  interval: {
    value: number;
    unit: IntervalUnit;
  };
  /** Raw cron expression — only used when mode === 'cron' */
  cronExpression: string;
  /** IANA timezone string, e.g. "Asia/Kolkata" */
  timezone: string;
}

/** Shape of data emitted on each tick */
export interface ScheduleTriggerOutput {
  /** ISO-8601 timestamp of when the trigger fired */
  timestamp: string;
  /** Human-friendly description of the schedule */
  schedule: string;
  timezone: string;
}

export type ScheduleTriggerProps = {
  config: ScheduleTriggerConfig;
  onChange: (config: ScheduleTriggerConfig) => void;
  className?: string;
};

/* ── Common IANA timezones ───────────────────────────────── */

const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const INTERVAL_UNITS: IntervalUnit[] = ['seconds', 'minutes', 'hours', 'days'];

/** Quick-pick preset cron expressions */
const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Every minute',      value: '* * * * *' },
  { label: 'Every 5 minutes',   value: '*/5 * * * *' },
  { label: 'Every 15 minutes',  value: '*/15 * * * *' },
  { label: 'Every 30 minutes',  value: '*/30 * * * *' },
  { label: 'Every hour',        value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9am',      value: '0 9 * * *' },
  { label: 'Weekly (Mon 9am)',  value: '0 9 * * 1' },
  { label: 'Monthly (1st)',     value: '0 0 1 * *' },
];

/* ── Component ───────────────────────────────────────────── */

export function ScheduleTrigger({ config, onChange, className }: ScheduleTriggerProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  const humanDescription = buildHumanDescription(config);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Node header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f59e0b]/10 text-[#f59e0b]">
          <LuCalendarClock className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Schedule Trigger</p>
          <p className="text-[11px] text-[var(--gray-9)]">{humanDescription}</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="space-y-1.5">
        <Label>Trigger Mode</Label>
        <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
          {(['interval', 'cron'] as ScheduleMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...config, mode: m })}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
                config.mode === m
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {m === 'interval' ? 'Simple Interval' : 'Cron Expression'}
            </button>
          ))}
        </div>
      </div>

      {/* Interval mode */}
      {config.mode === 'interval' && (
        <div className="space-y-3">
          <Label>Repeat every</Label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              className={cn(INPUT_CLS, 'w-24 shrink-0')}
              value={config.interval.value}
              onChange={(e) =>
                onChange({ ...config, interval: { ...config.interval, value: Math.max(1, Number(e.target.value)) } })
              }
            />
            <select
              className={cn(INPUT_CLS, 'flex-1')}
              value={config.interval.unit}
              onChange={(e) =>
                onChange({ ...config, interval: { ...config.interval, unit: e.target.value as IntervalUnit } })
              }
            >
              {INTERVAL_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Cron mode */}
      {config.mode === 'cron' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cron Expression</Label>
            <input
              type="text"
              className={cn(INPUT_CLS, 'font-mono')}
              value={config.cronExpression}
              onChange={(e) => onChange({ ...config, cronExpression: e.target.value })}
              placeholder="* * * * *"
            />
            <p className="text-[11px] text-[var(--gray-9)]">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>

          {/* Quick presets */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setPresetsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
            >
              Quick presets
              <LuChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', presetsOpen ? 'rotate-180' : '')}
                strokeWidth={2}
              />
            </button>

            {presetsOpen && (
              <div className="grid grid-cols-1 gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-1.5">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      onChange({ ...config, cronExpression: p.value });
                      setPresetsOpen(false);
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-md px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--gray-3)]',
                      config.cronExpression === p.value
                        ? 'bg-[#f76808]/10 text-[#f76808]'
                        : 'text-[var(--gray-11)]',
                    )}
                  >
                    <span>{p.label}</span>
                    <code className="text-[11px] font-mono text-[var(--gray-9)]">{p.value}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timezone */}
      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <select
          className={INPUT_CLS}
          value={config.timezone}
          onChange={(e) => onChange({ ...config, timezone: e.target.value })}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
          {!TIMEZONES.includes(config.timezone) && (
            <option value={config.timezone}>{config.timezone}</option>
          )}
        </select>
      </div>

      {/* Current summary */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
        <LuClock className="h-4 w-4 shrink-0 text-[#f59e0b]" strokeWidth={2} />
        <p className="text-[12px] text-[var(--gray-11)]">{humanDescription}</p>
      </div>

      {/* Output schema */}
      <OutputSchema
        fields={[
          { key: 'timestamp', type: 'string', description: 'ISO-8601 fire time' },
          { key: 'schedule',  type: 'string', description: 'Human-readable schedule description' },
          { key: 'timezone',  type: 'string', description: 'Configured timezone' },
        ]}
      />
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function buildHumanDescription(config: ScheduleTriggerConfig): string {
  if (config.mode === 'interval') {
    const { value, unit } = config.interval;
    return `Runs every ${value} ${value === 1 ? unit.replace(/s$/, '') : unit}`;
  }
  const preset = CRON_PRESETS.find((p) => p.value === config.cronExpression);
  if (preset) return preset.label;
  return `Cron: ${config.cronExpression || '(not set)'}`;
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[80px] text-[11.5px] font-mono font-medium text-[#f59e0b]">{f.key}</code>
            <span className="rounded bg-[var(--gray-4)] px-1 py-0.5 text-[10px] font-mono text-[var(--gray-9)]">{f.type}</span>
            <span className="flex-1 text-[11px] text-[var(--gray-9)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
