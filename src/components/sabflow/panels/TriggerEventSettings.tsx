'use client';

/**
 * TriggerEventSettings
 *
 * Editor for a `SabFlowEvent` (the workflow's trigger / starting node).
 *
 * Rendered inside `BlockSettingsPanel` when `openedNodeId` matches an event
 * rather than a block. For every trigger we render:
 *   - Header card: icon, label, "Start" badge, description
 *   - Type-specific basics: cron / webhook auth / manual sample payload
 *   - Filters: per-appEvent filter rows so the trigger only fires for matching events
 *   - Sample payload: JSON preview of `$trigger` for downstream variable mapping
 *   - About this trigger: the in-product docs surface
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
import {
  Play,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Filter,
  Code,
  CircleCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  Field,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from '@/components/sabcrm/20ui';

type Props = {
  event: SabFlowEvent;
  onUpdate: (changes: Partial<SabFlowEvent>) => void;
};

/** appEvents that are generic primitives - show full editor for these. */
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

  const Icon = meta?.icon ?? Play;
  const color = meta?.color ?? 'var(--st-accent)';
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

  const tinted = meta?.color != null;

  return (
    <div className="space-y-4">
      {/* Header card: trigger identity + "this is the starting node" hint */}
      <Card padding="sm">
        <CardBody className="flex gap-3 p-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
            style={tinted ? { background: `${color}1f`, color } : undefined}
            aria-hidden="true"
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-[var(--st-text)]">
                {label}
              </span>
              <Badge tone="accent" kind="soft" className="uppercase">
                Start
              </Badge>
            </div>
            {description && (
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--st-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

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
        <Callout tone="neutral">
          This trigger fires automatically whenever the matching SabNode event
          occurs. Connect a step below to define what happens, and add filters
          to narrow which events fire your flow.
        </Callout>
      )}

      {(event.type === 'start' || event.type === 'error') && (
        <Callout tone="neutral">
          {event.type === 'start'
            ? 'The workflow runs every time it starts. Connect a step below to define what happens first.'
            : 'This workflow will run whenever another flow throws an unhandled error.'}
        </Callout>
      )}

      {/* Filters: per-appEvent payload filter rows */}
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
      <Field
        label="Cron expression"
        help="Five-field cron: minute, hour, day-of-month, month, day-of-week."
      >
        <Input
          type="text"
          className="font-mono"
          value={options.cronExpression ?? ''}
          onChange={(e) => onChange({ cronExpression: e.target.value })}
          placeholder="0 9 * * 1-5"
        />
      </Field>
      <Field label="Timezone">
        <Input
          type="text"
          value={options.timezone ?? ''}
          onChange={(e) => onChange({ timezone: e.target.value })}
          placeholder="UTC"
        />
      </Field>
    </div>
  );
}

const METHOD_ITEMS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'ANY', label: 'ANY' },
] as const;

type WebhookMethod = (typeof METHOD_ITEMS)[number]['value'];

function WebhookFields({
  options,
  onChange,
}: {
  options: WebhookEventOptions;
  onChange: (patch: Partial<WebhookEventOptions>) => void;
}) {
  const method = (options.method ?? 'POST') as WebhookMethod;
  const auth = options.authentication ?? 'none';

  return (
    <div className="space-y-4">
      <Field label="Path">
        <Input
          type="text"
          className="font-mono"
          value={options.path ?? ''}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder="/my-webhook"
        />
      </Field>

      <Field label="Method">
        <SegmentedControl
          aria-label="HTTP method"
          items={METHOD_ITEMS}
          value={method}
          onChange={(m) => onChange({ method: m as WebhookEventOptions['method'] })}
        />
      </Field>

      <Field label="Authentication">
        <Select
          value={auth}
          onValueChange={(v) =>
            onChange({ authentication: v as WebhookEventOptions['authentication'] })
          }
        >
          <SelectTrigger aria-label="Authentication">
            <SelectValue placeholder="Choose authentication" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="header">Header</SelectItem>
            <SelectItem value="basic">Basic auth</SelectItem>
            <SelectItem value="query">Query parameter</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {auth === 'header' && (
        <>
          <Field label="Header name">
            <Input
              type="text"
              value={options.authHeaderName ?? ''}
              onChange={(e) => onChange({ authHeaderName: e.target.value })}
              placeholder="X-API-Key"
            />
          </Field>
          <Field label="Header value">
            <Input
              type="text"
              value={options.authHeaderValue ?? ''}
              onChange={(e) => onChange({ authHeaderValue: e.target.value })}
              placeholder="Secret token"
            />
          </Field>
        </>
      )}

      {auth === 'basic' && (
        <>
          <Field label="Username">
            <Input
              type="text"
              value={options.authBasicUser ?? ''}
              onChange={(e) => onChange({ authBasicUser: e.target.value })}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={options.authBasicPassword ?? ''}
              onChange={(e) => onChange({ authBasicPassword: e.target.value })}
            />
          </Field>
        </>
      )}

      <Field label="Response mode">
        <Select
          value={options.responseMode ?? 'immediately'}
          onValueChange={(v) =>
            onChange({ responseMode: v as WebhookEventOptions['responseMode'] })
          }
        >
          <SelectTrigger aria-label="Response mode">
            <SelectValue placeholder="Choose response mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediately">Respond immediately (200 OK)</SelectItem>
            <SelectItem value="lastNode">Respond with last node&apos;s output</SelectItem>
            <SelectItem value="responseNode">Respond from a Response node</SelectItem>
          </SelectContent>
        </Select>
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
      <Field
        label="Sample payload (JSON)"
        help="Used when running the flow manually so downstream steps see realistic input."
      >
        <Textarea
          className="min-h-[140px] resize-y font-mono text-[12px]"
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
              /* Ignore until valid, keep user typing without losing focus. */
            }
          }}
          placeholder={'{\n  "userId": "abc123"\n}'}
          rows={8}
        />
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
      icon={<Filter className="h-3.5 w-3.5" aria-hidden="true" />}
      title="Filters"
      hint="Only fire when ALL rows match the inbound payload."
      open={open}
      onToggle={() => setOpen(!open)}
    >
      {value.length === 0 ? (
        <p className="text-[11.5px] text-[var(--st-text-tertiary)]">
          No filters. The flow fires for every event of this type.
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
          <Button
            key={field.path}
            type="button"
            variant="outline"
            size="sm"
            iconLeft={Plus}
            onClick={() => addFilter(field)}
          >
            {field.label}
          </Button>
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
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 truncate text-[11px] font-semibold text-[var(--st-text)]">
          {field.label}
        </span>
        <IconButton
          label="Remove filter"
          icon={Trash2}
          size="sm"
          variant="ghost"
          onClick={onRemove}
        />
      </div>
      {field.hint && (
        <p className="mt-0.5 text-[10.5px] text-[var(--st-text-tertiary)]">{field.hint}</p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Select
          value={row.operator}
          onValueChange={(v) => onChange({ operator: v as EventFilterOperator })}
        >
          <SelectTrigger aria-label="Operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedOps.map((op) => (
              <SelectItem key={op} value={op}>
                {OP_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <Select
        value={String(value)}
        onValueChange={(v) => onChange({ value: v })}
      >
        <SelectTrigger aria-label={`${field.label} value`}>
          <SelectValue placeholder="Choose a value" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <Select
        value={String(value)}
        onValueChange={(v) => onChange({ value: v === 'true' })}
      >
        <SelectTrigger aria-label={`${field.label} value`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={field.kind === 'number' ? 'number' : 'text'}
      inputSize="sm"
      value={String(value)}
      placeholder={field.placeholder}
      aria-label={`${field.label} value`}
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
  gte: '>=',
  lt: '<',
  lte: '<=',
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
      icon={<Code className="h-3.5 w-3.5" aria-hidden="true" />}
      title="Sample payload"
      hint="Use these tokens in downstream steps via {{$trigger.…}}."
      open={open}
      onToggle={() => setOpen(!open)}
    >
      <pre className="max-h-72 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--st-text-secondary)]">
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
      icon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
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
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Fields
          </p>
          <ul className="mt-1 space-y-1.5">
            {doc.fields.map((f) => (
              <li key={f.name} className="text-[11.5px] leading-snug text-[var(--st-text-secondary)]">
                <span className="font-semibold text-[var(--st-text)]">{f.name}</span>
                {f.required ? <span className="ml-1 text-[var(--st-accent)]">*</span> : null}
                {f.defaultValue ? (
                  <span className="ml-1 rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[10.5px] text-[var(--st-text-secondary)]">
                    default: {f.defaultValue}
                  </span>
                ) : null}
                <span className="block text-[var(--st-text-tertiary)]">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.outputs && doc.outputs.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Available variables
          </p>
          <ul className="mt-1 space-y-1">
            {doc.outputs.map((o) => (
              <li key={o.token} className="flex items-start gap-1.5 text-[11.5px]">
                <code className="shrink-0 rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--st-accent)]">
                  {o.token}
                </code>
                <span className="text-[var(--st-text-secondary)]">{o.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.examples && doc.examples.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Examples
          </p>
          <ul className="mt-1 space-y-1">
            {doc.examples.map((ex) => (
              <li key={ex} className="flex items-start gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                <CircleCheck className="mt-[1px] h-3 w-3 shrink-0 text-[var(--st-accent)]" aria-hidden="true" />
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc.notes && doc.notes.length > 0 && (
        <div className="mt-3 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2 text-[11.5px] text-[var(--st-text-secondary)]">
          {doc.notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
    </Section>
  );
}

function DocBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--st-text-secondary)]">{body}</p>
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
    <Card padding="none">
      <Button
        variant="ghost"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          '[&_.u-btn__label]:flex [&_.u-btn__label]:flex-1 [&_.u-btn__label]:items-center [&_.u-btn__label]:gap-2',
        )}
      >
        <span className="flex flex-1 items-center gap-2">
          <span className="text-[var(--st-text-secondary)]">{icon}</span>
          <span className="flex-1">
            <span className="block text-[12px] font-semibold text-[var(--st-text)]">{title}</span>
            {hint && (
              <span className="block text-[10.5px] font-normal text-[var(--st-text-secondary)]">
                {hint}
              </span>
            )}
          </span>
          <span className="text-[var(--st-text-tertiary)]">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </span>
        </span>
      </Button>
      {open && <div className="border-t border-[var(--st-border)] p-3">{children}</div>}
    </Card>
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
