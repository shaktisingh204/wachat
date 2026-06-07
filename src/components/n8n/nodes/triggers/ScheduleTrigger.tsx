'use client';

import { useState } from 'react';
import { Clock, CalendarClock } from 'lucide-react';

import {
  cn,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SegmentedControl,
  Button,
  Badge,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';

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
  /** Raw cron expression, only used when mode === 'cron' */
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

const MODE_ITEMS = [
  { value: 'interval' as ScheduleMode, label: 'Simple Interval' },
  { value: 'cron' as ScheduleMode, label: 'Cron Expression' },
];

/* ── Component ───────────────────────────────────────────── */

export function ScheduleTrigger({ config, onChange, className }: ScheduleTriggerProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  const humanDescription = buildHumanDescription(config);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Node header */}
      <Card variant="outlined" padding="md">
        <CardHeader className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
            aria-hidden="true"
          >
            <CalendarClock size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-[12.5px]">Schedule Trigger</CardTitle>
            <CardDescription className="text-[11px]">{humanDescription}</CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Mode toggle */}
      <Field label="Trigger Mode">
        <SegmentedControl
          aria-label="Trigger mode"
          fullWidth
          items={MODE_ITEMS}
          value={config.mode}
          onChange={(mode) => onChange({ ...config, mode })}
        />
      </Field>

      {/* Interval mode */}
      {config.mode === 'interval' && (
        <Field label="Repeat every">
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              className="w-24 shrink-0"
              aria-label="Interval value"
              value={config.interval.value}
              onChange={(e) =>
                onChange({
                  ...config,
                  interval: { ...config.interval, value: Math.max(1, Number(e.target.value)) },
                })
              }
            />
            <Select
              value={config.interval.unit}
              onValueChange={(unit) =>
                onChange({ ...config, interval: { ...config.interval, unit: unit as IntervalUnit } })
              }
            >
              <SelectTrigger aria-label="Interval unit" className="flex-1">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="capitalize">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>
      )}

      {/* Cron mode */}
      {config.mode === 'cron' && (
        <div className="space-y-3">
          <Field
            label="Cron Expression"
            help="Format: minute hour day-of-month month day-of-week"
          >
            <Input
              type="text"
              className="font-mono"
              value={config.cronExpression}
              onChange={(e) => onChange({ ...config, cronExpression: e.target.value })}
              placeholder="* * * * *"
            />
          </Field>

          {/* Quick presets */}
          <Collapsible open={presetsOpen} onOpenChange={setPresetsOpen}>
            <CollapsibleTrigger>Quick presets</CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1.5">
                {CRON_PRESETS.map((p) => {
                  const selected = config.cronExpression === p.value;
                  return (
                    <Button
                      key={p.value}
                      variant={selected ? 'outline' : 'ghost'}
                      size="sm"
                      block
                      className="justify-between"
                      onClick={() => {
                        onChange({ ...config, cronExpression: p.value });
                        setPresetsOpen(false);
                      }}
                    >
                      <span>{p.label}</span>
                      <code className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                        {p.value}
                      </code>
                    </Button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Timezone */}
      <Field label="Timezone">
        <Select
          value={config.timezone}
          onValueChange={(timezone) => onChange({ ...config, timezone })}
        >
          <SelectTrigger aria-label="Timezone">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
            {!TIMEZONES.includes(config.timezone) && (
              <SelectItem value={config.timezone}>{config.timezone}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </Field>

      {/* Current summary */}
      <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
        <Clock size={16} strokeWidth={2} className="shrink-0 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <p className="text-[12px] text-[var(--st-text)]">{humanDescription}</p>
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

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <Field label="Output">
      <div className="divide-y divide-[var(--st-border-light)] rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[80px] font-mono text-[11.5px] font-medium text-[var(--st-text-secondary)]">
              {f.key}
            </code>
            <Badge tone="neutral" kind="soft" className="font-mono text-[10px]">
              {f.type}
            </Badge>
            <span className="flex-1 truncate text-[11px] text-[var(--st-text-secondary)]">
              {f.description}
            </span>
          </div>
        ))}
      </div>
    </Field>
  );
}
