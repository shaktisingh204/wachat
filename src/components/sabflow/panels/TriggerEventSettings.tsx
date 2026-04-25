'use client';
/**
 * TriggerEventSettings
 *
 * Editor for a `SabFlowEvent` (the workflow's trigger / starting node).
 *
 * Rendered inside `BlockSettingsPanel` when `openedNodeId` matches an event
 * rather than a block. Looks up rich label/icon/description metadata from
 * `TRIGGER_OPTIONS` via `event.appEvent`, then renders type-specific edit
 * fields:
 *   • schedule  — cron + timezone
 *   • webhook   — path, method, auth, response mode (generic webhooks only)
 *   • manual    — sample payload (JSON)
 *   • start/error/app-specific webhook — info-only (no setup required)
 */

import { useMemo } from 'react';
import type {
  ManualEventOptions,
  SabFlowEvent,
  ScheduleEventOptions,
  WebhookEventOptions,
} from '@/lib/sabflow/types';
import { TRIGGER_OPTIONS } from '@/components/sabflow/canvas/triggerPanel/triggerOptions';
import { LuPlay } from 'react-icons/lu';
import { cn } from '@/lib/utils';

type Props = {
  event: SabFlowEvent;
  onUpdate: (changes: Partial<SabFlowEvent>) => void;
};

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

/** appEvents that are generic primitives — show full editor for these. */
const GENERIC_APP_EVENTS = new Set([
  'flow_start',
  'on_schedule',
  'on_webhook',
  'manual_trigger',
  'on_error',
]);

export function TriggerEventSettings({ event, onUpdate }: Props) {
  const meta = useMemo(
    () => TRIGGER_OPTIONS.find((o) => o.appEvent === event.appEvent),
    [event.appEvent],
  );

  const Icon = meta?.icon ?? LuPlay;
  const color = meta?.color ?? '#10b981';
  const label = meta?.label ?? eventTypeLabel(event.type);
  const description = meta?.description;

  const isAppSpecific =
    !!event.appEvent && !GENERIC_APP_EVENTS.has(event.appEvent);

  const updateOptions = <T extends Record<string, unknown>>(patch: T) =>
    onUpdate({
      options: { ...(event.options ?? {}), ...patch } as SabFlowEvent['options'],
    });

  return (
    <div className="space-y-4">
      {/* Header card — trigger identity + "this is the starting node" hint */}
      <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 flex gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}1f`, color }}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-[var(--gray-12)] truncate">
              {label}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
              style={{ background: `${color}1f`, color }}
            >
              Start
            </span>
          </div>
          {description && (
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--gray-9)]">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Type-specific edit body */}
      {event.type === 'schedule' && (
        <ScheduleFields
          options={(event.options as ScheduleEventOptions | undefined) ?? { cronExpression: '' }}
          onChange={updateOptions}
        />
      )}

      {event.type === 'webhook' && !isAppSpecific && (
        <WebhookFields
          options={
            (event.options as WebhookEventOptions | undefined) ?? {
              path: '',
              method: 'POST',
              authentication: 'none',
              responseMode: 'immediately',
            }
          }
          onChange={updateOptions}
        />
      )}

      {event.type === 'manual' && (
        <ManualFields
          options={(event.options as ManualEventOptions | undefined) ?? {}}
          onChange={updateOptions}
        />
      )}

      {/* App-specific webhooks: handled by the platform integration; nothing
          to configure here beyond knowing the event will fire. */}
      {event.type === 'webhook' && isAppSpecific && (
        <InfoCard>
          This trigger fires automatically whenever the matching SabNode event
          occurs. Connect a step below to define what the workflow does when it
          fires — no other setup is required.
        </InfoCard>
      )}

      {(event.type === 'start' || event.type === 'error') && (
        <InfoCard>
          {event.type === 'start'
            ? 'The workflow runs every time it starts. Connect a step below to define what happens first.'
            : 'This workflow will run whenever another flow throws an unhandled error.'}
        </InfoCard>
      )}
    </div>
  );
}

/* ─────────────────────────── Type-specific blocks ─────────────────────────── */

function ScheduleFields({
  options,
  onChange,
}: {
  options: ScheduleEventOptions;
  onChange: (patch: Partial<ScheduleEventOptions>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Cron expression">
        <input
          type="text"
          className={cn(inputClass, 'font-mono')}
          value={options.cronExpression ?? ''}
          onChange={(e) => onChange({ cronExpression: e.target.value })}
          placeholder="0 9 * * 1-5"
        />
        <p className="mt-1 text-[11px] text-[var(--gray-8)]">
          Five-field cron: minute, hour, day-of-month, month, day-of-week.
        </p>
      </Field>
      <Field label="Timezone">
        <input
          type="text"
          className={inputClass}
          value={options.timezone ?? ''}
          onChange={(e) => onChange({ timezone: e.target.value })}
          placeholder="UTC"
        />
      </Field>
    </div>
  );
}

function WebhookFields({
  options,
  onChange,
}: {
  options: WebhookEventOptions;
  onChange: (patch: Partial<WebhookEventOptions>) => void;
}) {
  const method = options.method ?? 'POST';
  const auth = options.authentication ?? 'none';

  return (
    <div className="space-y-4">
      <Field label="Path">
        <input
          type="text"
          className={cn(inputClass, 'font-mono')}
          value={options.path ?? ''}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder="/my-webhook"
        />
      </Field>

      <Field label="Method">
        <div className="flex gap-1.5 flex-wrap">
          {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ method: m })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-mono font-semibold transition-colors',
                method === m
                  ? 'border-[#f76808] bg-[#f76808]/10 text-[#f76808]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Authentication">
        <select
          className={inputClass}
          value={auth}
          onChange={(e) =>
            onChange({ authentication: e.target.value as WebhookEventOptions['authentication'] })
          }
        >
          <option value="none">None</option>
          <option value="header">Header</option>
          <option value="basic">Basic auth</option>
          <option value="query">Query parameter</option>
        </select>
      </Field>

      {auth === 'header' && (
        <>
          <Field label="Header name">
            <input
              type="text"
              className={inputClass}
              value={options.authHeaderName ?? ''}
              onChange={(e) => onChange({ authHeaderName: e.target.value })}
              placeholder="X-API-Key"
            />
          </Field>
          <Field label="Header value">
            <input
              type="text"
              className={inputClass}
              value={options.authHeaderValue ?? ''}
              onChange={(e) => onChange({ authHeaderValue: e.target.value })}
              placeholder="••••••••"
            />
          </Field>
        </>
      )}

      {auth === 'basic' && (
        <>
          <Field label="Username">
            <input
              type="text"
              className={inputClass}
              value={options.authBasicUser ?? ''}
              onChange={(e) => onChange({ authBasicUser: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={options.authBasicPassword ?? ''}
              onChange={(e) => onChange({ authBasicPassword: e.target.value })}
            />
          </Field>
        </>
      )}

      <Field label="Response mode">
        <select
          className={inputClass}
          value={options.responseMode ?? 'immediately'}
          onChange={(e) =>
            onChange({ responseMode: e.target.value as WebhookEventOptions['responseMode'] })
          }
        >
          <option value="immediately">Respond immediately (200 OK)</option>
          <option value="lastNode">Respond with last node&apos;s output</option>
          <option value="responseNode">Respond from a Response node</option>
        </select>
      </Field>
    </div>
  );
}

function ManualFields({
  options,
  onChange,
}: {
  options: ManualEventOptions;
  onChange: (patch: Partial<ManualEventOptions>) => void;
}) {
  const text = useMemo(() => {
    if (!options.samplePayload) return '';
    try {
      return JSON.stringify(options.samplePayload, null, 2);
    } catch {
      return '';
    }
  }, [options.samplePayload]);

  return (
    <div className="space-y-4">
      <Field label="Sample payload (JSON)">
        <textarea
          className={cn(inputClass, 'font-mono text-[12px] resize-y min-h-[140px]')}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim() === '') {
              onChange({ samplePayload: undefined });
              return;
            }
            try {
              onChange({ samplePayload: JSON.parse(raw) });
            } catch {
              /* Ignore until valid — keep user typing without losing focus.
                 The textarea reflects the in-flight string via a fallback below. */
            }
          }}
          placeholder={'{\n  "userId": "abc123"\n}'}
          rows={8}
        />
        <p className="mt-1 text-[11px] text-[var(--gray-8)]">
          Used when running the flow manually so downstream steps see realistic
          input.
        </p>
      </Field>
    </div>
  );
}

/* ─────────────────────────── Shared primitives ─────────────────────────── */

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

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] p-3 text-[12px] leading-relaxed text-[var(--gray-9)]">
      {children}
    </div>
  );
}

function eventTypeLabel(type: SabFlowEvent['type']): string {
  switch (type) {
    case 'start':
      return 'When the flow starts';
    case 'schedule':
      return 'On a schedule';
    case 'webhook':
      return 'On webhook call';
    case 'manual':
      return 'Trigger manually';
    case 'error':
      return 'On error';
  }
}
