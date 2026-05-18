'use client';

/**
 * TriggerEventSettings
 *
 * Editor for a `SabFlowEvent` (the workflow's trigger / starting node).
 *
 * Rendered inside `BlockSettingsPanel` when `openedNodeId` matches an event
 * rather than a block. For every trigger we render:
 *   • Header card — icon, label, "Start" badge, description
 *   • Type-specific basics — cron / webhook auth / manual sample payload
 *   • Filters — per-appEvent filter rows so the trigger only fires for matching events
 *   • Sample payload — JSON preview of `$trigger` for downstream variable mapping
 *   • About this trigger — the in-product docs surface
 */

import { useMemo, useState } from 'react';
import type {
  EventFilter,
  EventFilterOperator,
  ManualEventOptions,
  SabFlowEvent,
  ScheduleEventOptions,
  WebhookEventOptions,
} from '@/lib/sabflow/types';
import { TRIGGER_OPTIONS } from '@/components/sabflow/canvas/triggerPanel/triggerOptions';
import { getTriggerFilters, type FilterField } from '@/lib/sabflow/docs/triggerFilters';
import { getSamplePayload } from '@/lib/sabflow/docs/samplePayloads';
import { getNodeDoc } from '@/lib/sabflow/docs/nodeDocs';
import { LuPlay, LuPlus, LuTrash2, LuChevronDown, LuChevronRight, LuBookOpen, LuFilter, LuCode, LuCircleCheck } from 'react-icons/lu';
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
  const docKey = event.appEvent ?? event.type;
  const doc = getNodeDoc(docKey);
  const filters = getTriggerFilters(event.appEvent);
  const samplePayload = useMemo(() => getSamplePayload(event.appEvent), [event.appEvent]);

  const isAppSpecific =
    !!event.appEvent && !GENERIC_APP_EVENTS.has(event.appEvent);

  const updateOptions = <T extends Record<string, unknown>>(patch: T) =>
    onUpdate({
      options: { ...(event.options ?? {}), ...patch } as SabFlowEvent['options'],
    });

  const optionFilters: EventFilter[] =
    ((event.options as WebhookEventOptions | undefined)?.filters as EventFilter[] | undefined) ?? [];

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
          to configure beyond optional filters. */}
      {event.type === 'webhook' && isAppSpecific && (
        <InfoCard>
          This trigger fires automatically whenever the matching SabNode event
          occurs. Connect a step below to define what happens — and add filters
          to narrow which events fire your flow.
        </InfoCard>
      )}

      {(event.type === 'start' || event.type === 'error') && (
        <InfoCard>
          {event.type === 'start'
            ? 'The workflow runs every time it starts. Connect a step below to define what happens first.'
            : 'This workflow will run whenever another flow throws an unhandled error.'}
        </InfoCard>
      )}

      {/* Filters — per-appEvent payload filter rows */}
      {filters.length > 0 && (
        <FiltersSection
          fields={filters}
          value={optionFilters}
          onChange={(next) => updateOptions({ filters: next })}
        />
      )}

      {/* Sample payload preview */}
      {samplePayload !== undefined && (
        <SamplePayloadPreview payload={samplePayload} />
      )}

      {/* Docs */}
      {doc && <DocsSection doc={doc} />}
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
              /* Ignore until valid — keep user typing without losing focus. */
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

/* ─────────────────────────── Filters ─────────────────────────── */

function FiltersSection({
  fields,
  value,
  onChange,
}: {
  fields: FilterField[];
  value: EventFilter[];
  onChange: (next: EventFilter[]) => void;
}) {
  const [open, setOpen] = useState(value.length > 0);

  const addFilter = (field: FilterField) => {
    const next: EventFilter = {
      path: field.path,
      operator: field.defaultOperator,
      value: '',
    };
    onChange([...value, next]);
    setOpen(true);
  };

  const updateAt = (index: number, patch: Partial<EventFilter>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <Section
      icon={<LuFilter className="h-3.5 w-3.5" />}
      title="Filters"
      hint="Only fire when ALL rows match the inbound payload."
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {value.length === 0 ? (
        <p className="text-[11.5px] text-[var(--gray-8)]">
          No filters — the flow fires for every event of this type.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((row, i) => {
            const field = fields.find((f) => f.path === row.path) ?? fields[0];
            return (
              <FilterRow
                key={`${row.path}-${i}`}
                field={field}
                row={row}
                onChange={(patch) => updateAt(i, patch)}
                onRemove={() => removeAt(i)}
              />
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {fields.map((field) => (
          <button
            key={field.path}
            type="button"
            onClick={() => addFilter(field)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] px-2 py-1 text-[11px] text-[var(--gray-10)] hover:border-[#f76808] hover:text-[#f76808] transition-colors"
          >
            <LuPlus className="h-3 w-3" />
            {field.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function FilterRow({
  field,
  row,
  onChange,
  onRemove,
}: {
  field: FilterField;
  row: EventFilter;
  onChange: (patch: Partial<EventFilter>) => void;
  onRemove: () => void;
}) {
  const allowedOps: EventFilterOperator[] =
    field.operators ?? defaultOperatorsFor(field.kind);

  const showValue = row.operator !== 'exists' && row.operator !== 'not_exists';

  return (
    <div className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] p-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-[var(--gray-11)] flex-1 truncate">
          {field.label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-[var(--gray-8)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label="Remove filter"
        >
          <LuTrash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {field.hint && (
        <p className="mt-0.5 text-[10.5px] text-[var(--gray-8)]">{field.hint}</p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <select
          className={cn(inputClass, 'py-1 text-[11.5px]')}
          value={row.operator}
          onChange={(e) => onChange({ operator: e.target.value as EventFilterOperator })}
        >
          {allowedOps.map((op) => (
            <option key={op} value={op}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>
        {showValue && (
          <FilterValueInput field={field} row={row} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

function FilterValueInput({
  field,
  row,
  onChange,
}: {
  field: FilterField;
  row: EventFilter;
  onChange: (patch: Partial<EventFilter>) => void;
}) {
  const value = row.value ?? '';

  if (field.kind === 'select') {
    return (
      <select
        className={cn(inputClass, 'py-1 text-[11.5px]')}
        value={String(value)}
        onChange={(e) => onChange({ value: e.target.value })}
      >
        <option value="">Choose…</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <select
        className={cn(inputClass, 'py-1 text-[11.5px]')}
        value={String(value)}
        onChange={(e) => onChange({ value: e.target.value === 'true' })}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <input
      type={field.kind === 'number' ? 'number' : 'text'}
      className={cn(inputClass, 'py-1 text-[11.5px]')}
      value={String(value)}
      placeholder={field.placeholder}
      onChange={(e) =>
        onChange({
          value:
            field.kind === 'number' && e.target.value !== ''
              ? Number(e.target.value)
              : e.target.value,
        })
      }
    />
  );
}

const OP_LABELS: Record<EventFilterOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'is one of',
  not_in: 'is not one of',
  exists: 'is set',
  not_exists: 'is not set',
};

function defaultOperatorsFor(kind: FilterField['kind']): EventFilterOperator[] {
  switch (kind) {
    case 'number':
      return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'];
    case 'boolean':
      return ['equals', 'not_equals'];
    case 'select':
      return ['equals', 'not_equals', 'in', 'not_in'];
    case 'multiselect':
      return ['contains', 'not_contains', 'in', 'not_in'];
    case 'text':
    default:
      return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'exists', 'not_exists'];
  }
}

/* ─────────────────────────── Sample payload preview ─────────────────────────── */

function SamplePayloadPreview({ payload }: { payload: unknown }) {
  const [open, setOpen] = useState(false);
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  return (
    <Section
      icon={<LuCode className="h-3.5 w-3.5" />}
      title="Sample payload"
      hint="Use these tokens in downstream steps via {{$trigger.…}}."
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <pre className="max-h-72 overflow-auto rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] p-2.5 text-[11.5px] leading-relaxed text-[var(--gray-11)] font-mono">
        {json}
      </pre>
    </Section>
  );
}

/* ─────────────────────────── Docs ─────────────────────────── */

function DocsSection({ doc }: { doc: ReturnType<typeof getNodeDoc> & object }) {
  const [open, setOpen] = useState(false);

  return (
    <Section
      icon={<LuBookOpen className="h-3.5 w-3.5" />}
      title="About this trigger"
      hint={doc.summary}
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {doc.whenItFires && (
        <DocBlock title="When it fires" body={doc.whenItFires} />
      )}

      {doc.fields && doc.fields.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
            Fields
          </p>
          <ul className="mt-1 space-y-1.5">
            {doc.fields.map((f) => (
              <li key={f.name} className="text-[11.5px] leading-snug text-[var(--gray-11)]">
                <span className="font-semibold text-[var(--gray-12)]">{f.name}</span>
                {f.required ? <span className="ml-1 text-red-500">*</span> : null}
                {f.defaultValue ? (
                  <span className="ml-1 rounded bg-[var(--gray-3)] px-1 font-mono text-[10.5px] text-[var(--gray-10)]">
                    default: {f.defaultValue}
                  </span>
                ) : null}
                <span className="block text-[var(--gray-9)]">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.outputs && doc.outputs.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
            Available variables
          </p>
          <ul className="mt-1 space-y-1">
            {doc.outputs.map((o) => (
              <li key={o.token} className="flex items-start gap-1.5 text-[11.5px]">
                <code className="shrink-0 rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[10.5px] text-[#f76808]">
                  {o.token}
                </code>
                <span className="text-[var(--gray-10)]">{o.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.examples && doc.examples.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
            Examples
          </p>
          <ul className="mt-1 space-y-1">
            {doc.examples.map((ex) => (
              <li key={ex} className="flex items-start gap-1.5 text-[11.5px] text-[var(--gray-11)]">
                <LuCircleCheck className="mt-[1px] h-3 w-3 shrink-0 text-emerald-500" />
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.notes && doc.notes.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)] p-2 text-[11.5px] text-[var(--gray-10)]">
          {doc.notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
    </Section>
  );
}

function DocBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--gray-11)]">{body}</p>
    </div>
  );
}

/* ─────────────────────────── Shared primitives ─────────────────────────── */

function Section({
  icon,
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="text-[var(--gray-10)]">{icon}</span>
        <span className="flex-1">
          <span className="block text-[12px] font-semibold text-[var(--gray-12)]">{title}</span>
          {hint && (
            <span className="block text-[10.5px] text-[var(--gray-9)]">{hint}</span>
          )}
        </span>
        <span className="text-[var(--gray-8)]">
          {open ? <LuChevronDown className="h-3.5 w-3.5" /> : <LuChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <div className="border-t border-[var(--gray-5)] p-3">{children}</div>}
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
