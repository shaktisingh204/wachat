'use client';

/**
 * SabCRM Settings - Workflows (`/dashboard/settings/crm/automations`).
 *
 * The automation surface, on the 20ui flow canvas:
 *
 *   - LEFT  — every workflow: name, trigger badge, enabled toggle, runs link,
 *             edit + delete actions.
 *   - RIGHT — the editor for the selected workflow:
 *       Canvas tab — the trigger + steps rendered as a vertical chain on
 *         `AutomationCanvas` (`@xyflow/react` composite,
 *         `@/components/sabcrm/20ui/composites/flow/automation-canvas`), with a
 *         side CONFIG PANEL for the selected node:
 *           trigger  — full event vocabulary (record.created / updated /
 *                      deleted / stage_changed / status_changed, time.elapsed,
 *                      manual, cron, webhook) incl. per-event params (watched
 *                      field + from/to for *_changed, idle duration +
 *                      sinceField for time.elapsed, intervalMinutes for cron),
 *           condition — filter / if_else `{ field, operator, value }` row with
 *                      the full operator set (eq…lte, in/nin, contains,
 *                      isEmpty, in_stage, has_tag, …),
 *           action   — per-type forms (create_task title/body,
 *                      send_notification, update_field, webhook,
 *                      send_whatsapp_template templateId/to/variables,
 *                      find_records, upsert_record).
 *         Steps are added from a type menu, reordered / removed / muted from
 *         the panel; on-canvas Delete also removes a step.
 *       Runs tab — run history (status badges, relative times, expandable
 *         per-step status + errors), refreshed after every Run-now.
 *
 * ## Workflow ↔ canvas mapping
 *
 * The engine model is a LINEAR pipeline: one `trigger` + ordered `steps`;
 * `filter` / `if_else` steps gate the REST of the run (no branching), so the
 * canvas renders a single vertical chain. `workflowFlowNodes()` maps
 * `{ trigger, steps }` → `AutomationFlowNode[]`: a sentinel trigger node
 * (`__trigger__`) followed by one node per step (`kind: 'condition'` for
 * filter / if_else, `'action'` otherwise) with per-node icon, summary and
 * an `invalid` flag for missing required config.
 *
 * Wired to the workflows engine through the gated server actions in
 * `@/app/actions/sabcrm-workflows.actions` (list / get / create / update /
 * delete), `runWorkflowNowTw` (manual run) and `listWorkflowRunsTw` (history).
 * Object pickers read `listObjectsTw`. The engine may be DOWN at dev time —
 * every call is normalised to `{ ok, ... }` and the UI degrades to graceful
 * loading / empty / error states and never crashes.
 *
 * Pure 20ui throughout (no legacy `.st-*` classes); styling rides `--st-*`
 * tokens only.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Zap,
  Plus,
  PlusCircle,
  AlertTriangle,
  ClipboardList,
  Bell,
  Webhook,
  PenLine,
  Workflow as WorkflowIcon,
  Play,
  Loader2,
  History,
  Filter as FilterIcon,
  GitBranch,
  Search,
  RefreshCw,
  CircleDot,
  CircleCheck,
  CircleX,
  ChevronRight,
  Trash2,
  Clock,
  CalendarClock,
  Hand,
  ArrowRightLeft,
  ToggleLeft,
  MessageSquareText,
  ArrowUp,
  ArrowDown,
  Save,
  Settings2,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  IconButton,
  Switch,
  SegmentedControl,
  type SegmentedItem,
  Alert,
  Badge,
  type BadgeTone,
  EmptyState,
  Skeleton,
  Field,
  Input,
  Textarea,
  SelectField,
  type SelectOption,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/sabcrm/20ui';
import {
  AutomationCanvas,
  type AutomationFlowNode,
} from '@/components/sabcrm/20ui/composites/flow/automation-canvas';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  listWorkflowsTw,
  getWorkflowTw,
  createWorkflowTw,
  updateWorkflowTw,
  deleteWorkflowTw,
} from '@/app/actions/sabcrm-workflows.actions';
import { runWorkflowNowTw } from '@/app/actions/sabcrm-runtime.actions';
import { listWorkflowRunsTw } from '@/app/actions/sabcrm-workflow-runs.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Local types (mirror the engine wire shapes from
// `@/lib/rust-client/sabcrm-workflows`; kept local so this client page never
// pulls a `server-only` guard into the bundle).
// ---------------------------------------------------------------------------

type TriggerEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted'
  | 'record.stage_changed'
  | 'record.status_changed'
  | 'time.elapsed'
  | 'manual'
  | 'cron'
  | 'webhook'
  | (string & {});

type StepType =
  | 'create_task'
  | 'send_notification'
  | 'update_field'
  | 'webhook'
  | 'filter'
  | 'if_else'
  | 'find_records'
  | 'upsert_record'
  | 'send_whatsapp_template'
  | (string & {});

/** Trigger extras (field/fromValue/toValue, afterMinutes…, config) ride as
 *  forward-compatible top-level keys, hence the index signature. */
interface WorkflowTrigger {
  event: TriggerEvent;
  object?: string;
  [key: string]: unknown;
}

interface WorkflowStep {
  id: string;
  type: StepType;
  config: Record<string, unknown>;
  /** Defaults to `true` server-side when omitted. */
  enabled?: boolean;
  [key: string]: unknown;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  /** ISO timestamp (or epoch ms) of the last execution, when reported. */
  lastRunAt?: string | number | null;
  [key: string]: unknown;
}

// -- Run history (from `listWorkflowRunsTw`) --------------------------------

type RunStatus =
  | 'success'
  | 'completed'
  | 'failed'
  | 'error'
  | 'running'
  | 'pending'
  | 'queued'
  | string;

interface WorkflowRunStep {
  id: string;
  type: string;
  status: RunStatus;
  error?: string;
}

interface WorkflowRun {
  id: string;
  status: RunStatus;
  startedAt: string | number;
  finishedAt?: string | number | null;
  steps: WorkflowRunStep[];
}

type CreateInput = {
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
};

type WorkflowPatch = Partial<CreateInput>;

// ---------------------------------------------------------------------------
// Catalogues
// ---------------------------------------------------------------------------

/** Sentinel canvas-node id for the trigger (steps use their own ids). */
const TRIGGER_NODE_ID = '__trigger__';

interface EventMeta {
  label: string;
  icon: LucideIcon;
  /** Tone of the list-row trigger badge. */
  tone: BadgeTone;
}

const EVENT_META: Record<string, EventMeta> = {
  'record.created': { label: 'Record Created', icon: PlusCircle, tone: 'success' },
  'record.updated': { label: 'Record Updated', icon: PenLine, tone: 'info' },
  'record.deleted': { label: 'Record Deleted', icon: Trash2, tone: 'danger' },
  'record.stage_changed': { label: 'Stage Changed', icon: ArrowRightLeft, tone: 'info' },
  'record.status_changed': { label: 'Status Changed', icon: ToggleLeft, tone: 'info' },
  'time.elapsed': { label: 'Time Elapsed', icon: Clock, tone: 'warning' },
  manual: { label: 'Manual', icon: Hand, tone: 'neutral' },
  cron: { label: 'Schedule', icon: CalendarClock, tone: 'neutral' },
  webhook: { label: 'Incoming Webhook', icon: Webhook, tone: 'neutral' },
};

const EVENT_OPTIONS: SelectOption[] = Object.entries(EVENT_META).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

/** Trigger events bound to a record object (object picker required). */
function eventNeedsObject(event: TriggerEvent): boolean {
  return String(event).startsWith('record.') || event === 'time.elapsed';
}

interface StepMeta {
  label: string;
  icon: LucideIcon;
  blurb: string;
  kind: 'condition' | 'action';
}

const STEP_META: Record<string, StepMeta> = {
  filter: {
    label: 'Filter',
    icon: FilterIcon,
    blurb: 'Stop unless the condition passes',
    kind: 'condition',
  },
  if_else: {
    label: 'If / Else',
    icon: GitBranch,
    blurb: 'Continue only when the condition is true',
    kind: 'condition',
  },
  create_task: { label: 'Create Task', icon: ClipboardList, blurb: 'Add a task', kind: 'action' },
  send_notification: {
    label: 'Send Notification',
    icon: Bell,
    blurb: 'Notify a user',
    kind: 'action',
  },
  update_field: { label: 'Update Field', icon: PenLine, blurb: 'Set a field value', kind: 'action' },
  webhook: { label: 'Webhook', icon: Webhook, blurb: 'Call an external URL', kind: 'action' },
  send_whatsapp_template: {
    label: 'WhatsApp Template',
    icon: MessageSquareText,
    blurb: 'Send a WaChat template message',
    kind: 'action',
  },
  find_records: {
    label: 'Find Records',
    icon: Search,
    blurb: 'Query matching records',
    kind: 'action',
  },
  upsert_record: {
    label: 'Upsert Record',
    icon: RefreshCw,
    blurb: 'Update or create a record',
    kind: 'action',
  },
};

/** Condition operators (filter / if_else) — the runtime's full vocabulary. */
const OPERATOR_OPTIONS: SelectOption[] = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'in', label: 'is one of' },
  { value: 'nin', label: 'is not one of' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
  { value: 'in_stage', label: 'is in stage' },
  { value: 'has_tag', label: 'has tag' },
  { value: 'not_has_tag', label: 'does not have tag' },
  { value: 'truthy', label: 'is truthy' },
  { value: 'falsy', label: 'is falsy' },
];

const OPERATOR_LABEL: Record<string, string> = Object.fromEntries(
  OPERATOR_OPTIONS.map((o) => [o.value, o.label]),
);

/** Operators with no right-hand value. */
const NO_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty', 'truthy', 'falsy']);
/** Operators that carry their own default subject (field optional). */
const FIELDLESS_OPERATORS = new Set(['in_stage', 'has_tag', 'not_has_tag']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function posNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Total idle minutes of a `time.elapsed` trigger (extras compose). */
function elapsedMinutes(t: WorkflowTrigger): number {
  return (
    posNum(t.afterMinutes) + posNum(t.afterHours) * 60 + posNum(t.afterDays) * 60 * 24
  );
}

function formatMinutes(total: number): string {
  if (total <= 0) return '0m';
  const d = Math.floor(total / (60 * 24));
  const h = Math.floor((total % (60 * 24)) / 60);
  const m = total % 60;
  return [d ? `${d}d` : '', h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

function eventLabel(event: TriggerEvent): string {
  return EVENT_META[event]?.label ?? String(event);
}

function triggerSummary(t: WorkflowTrigger): string {
  const ev = eventLabel(t.event);
  if (String(t.event).startsWith('record.')) {
    const base = t.object ? `${ev} on ${t.object}` : `${ev} — pick an object`;
    if (t.event === 'record.stage_changed' || t.event === 'record.status_changed') {
      const from = str(t as Record<string, unknown>, 'fromValue');
      const to = str(t as Record<string, unknown>, 'toValue');
      if (from || to) return `${base} (${from || 'any'} → ${to || 'any'})`;
    }
    return base;
  }
  if (t.event === 'time.elapsed') {
    const mins = elapsedMinutes(t);
    const dur = mins > 0 ? `idle ${formatMinutes(mins)}` : 'idle timer not set';
    return t.object ? `${t.object} ${dur}` : `${ev} — pick an object`;
  }
  if (t.event === 'cron') {
    const cfg = (t.config ?? {}) as Record<string, unknown>;
    const n = posNum(cfg.intervalMinutes ?? cfg.interval);
    return n > 0 ? `Every ${formatMinutes(n)}` : 'On a schedule';
  }
  return ev;
}

function stepSummary(step: WorkflowStep): string {
  const c = step.config ?? {};
  switch (step.type) {
    case 'filter':
    case 'if_else': {
      const op = str(c, 'operator') || 'eq';
      const field = str(c, 'field') || (FIELDLESS_OPERATORS.has(op) ? '' : 'field?');
      const value = NO_VALUE_OPERATORS.has(op) ? '' : str(c, 'value');
      return [field, OPERATOR_LABEL[op] ?? op, value].filter(Boolean).join(' ');
    }
    case 'create_task':
      return str(c, 'title') || 'Workflow task';
    case 'send_notification':
      return str(c, 'title') || 'Workflow notification';
    case 'update_field': {
      const field = str(c, 'field');
      return field ? `${field} = ${str(c, 'value')}` : 'Pick a field';
    }
    case 'webhook':
      return str(c, 'url') || 'Set a URL';
    case 'send_whatsapp_template': {
      const tpl = str(c, 'templateId');
      const to = str(c, 'to');
      return tpl ? `Template ${tpl}${to ? ` → ${to}` : ''}` : 'Pick a template';
    }
    case 'find_records':
      return `Find in ${str(c, 'object') || 'trigger object'}`;
    case 'upsert_record':
      return `Upsert in ${str(c, 'object') || 'trigger object'}`;
    default:
      return STEP_META[step.type]?.blurb ?? '';
  }
}

/** Missing required trigger config (mirrors the create-action's guards +
 *  the scheduler's `time.elapsed` requirements). */
function triggerInvalid(t: WorkflowTrigger): boolean {
  if (String(t.event).startsWith('record.') && !t.object) return true;
  if (t.event === 'time.elapsed') return !t.object || elapsedMinutes(t) <= 0;
  return false;
}

/** Missing required step config (mirrors the runtime's hard requirements). */
function stepInvalid(step: WorkflowStep): boolean {
  const c = step.config ?? {};
  switch (step.type) {
    case 'update_field':
      return !str(c, 'field');
    case 'webhook':
      return !str(c, 'url');
    case 'send_whatsapp_template':
      return !str(c, 'templateId') || !str(c, 'to');
    case 'filter':
    case 'if_else': {
      const op = str(c, 'operator') || 'eq';
      return !FIELDLESS_OPERATORS.has(op) && !str(c, 'field');
    }
    default:
      return false;
  }
}

/**
 * Workflow → canvas chain. The trigger becomes the sentinel `__trigger__`
 * node; each step becomes one node (`condition` for filter / if_else,
 * `action` otherwise), in run order.
 */
function workflowFlowNodes(draft: Workflow): AutomationFlowNode[] {
  const trigger: AutomationFlowNode = {
    id: TRIGGER_NODE_ID,
    kind: 'trigger',
    title: eventLabel(draft.trigger.event),
    summary: triggerSummary(draft.trigger),
    icon: EVENT_META[draft.trigger.event]?.icon ?? Zap,
    invalid: triggerInvalid(draft.trigger),
  };
  const steps: AutomationFlowNode[] = draft.steps.map((step) => {
    const meta = STEP_META[step.type];
    return {
      id: step.id,
      kind: meta?.kind ?? 'action',
      title: meta?.label ?? step.type,
      summary: stepSummary(step),
      icon: meta?.icon ?? Zap,
      invalid: stepInvalid(step),
      muted: step.enabled === false,
    };
  });
  return [trigger, ...steps];
}

/** New step id — short + readable (referenceable via `{{steps.<id>.*}}`). */
function newStepId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Stable-ish equality for the dirty flag (avoids JSON key-order traps lightly). */
function sameWorkflow(a: Workflow, b: Workflow): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compact "x ago" rendering for a `lastRunAt` value; null when absent/invalid. */
function relativeTimeFrom(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
}

/** Normalise an engine run/step status to a small UI bucket. */
function statusBucket(status: RunStatus): 'ok' | 'fail' | 'run' | 'wait' {
  const s = String(status).toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'ok' || s === 'done') return 'ok';
  if (s === 'failed' || s === 'error' || s === 'errored') return 'fail';
  if (s === 'running' || s === 'in_progress' || s === 'active') return 'run';
  return 'wait';
}

const STATUS_ICON: Record<
  'ok' | 'fail' | 'run' | 'wait',
  React.ComponentType<{ size?: number; className?: string }>
> = {
  ok: CircleCheck,
  fail: CircleX,
  run: Loader2,
  wait: CircleDot,
};

const STATUS_LABEL: Record<'ok' | 'fail' | 'run' | 'wait', string> = {
  ok: 'Success',
  fail: 'Failed',
  run: 'Running',
  wait: 'Pending',
};

const STATUS_TONE: Record<'ok' | 'fail' | 'run' | 'wait', BadgeTone> = {
  ok: 'success',
  fail: 'danger',
  run: 'info',
  wait: 'neutral',
};

// ---------------------------------------------------------------------------
// Config-panel building blocks
// ---------------------------------------------------------------------------

/** Textarea that round-trips a JSON object config value (commit on blur). */
function JsonField({
  label,
  help,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  help?: string;
  value: unknown;
  onCommit: (next: Record<string, unknown> | undefined) => void;
  placeholder?: string;
}): React.JSX.Element {
  const [text, setText] = React.useState<string>(() =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(value, null, 2)
      : '',
  );
  const [error, setError] = React.useState<string | null>(null);

  const commit = (): void => {
    const t = text.trim();
    if (!t) {
      setError(null);
      onCommit(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(t);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setError(null);
        onCommit(parsed as Record<string, unknown>);
      } else {
        setError('Must be a JSON object, e.g. {"name": "value"}.');
      }
    } catch {
      setError('Invalid JSON.');
    }
  };

  return (
    <Field label={label} help={help} error={error}>
      <Textarea
        rows={4}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        className="font-mono text-xs"
      />
    </Field>
  );
}

/** Shared shell of every config-panel section. */
function PanelShell({
  icon: Icon,
  title,
  actions,
  children,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card padding="none" className="self-start overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-2.5">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Icon size={13} aria-hidden="true" />
          {title}
        </CardTitle>
        {actions}
      </CardHeader>
      <CardBody className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-4">
        {children}
      </CardBody>
    </Card>
  );
}

// -- Trigger panel -----------------------------------------------------------

function TriggerPanel({
  trigger,
  objects,
  onChange,
}: {
  trigger: WorkflowTrigger;
  objects: ObjectMetadata[];
  onChange: (next: WorkflowTrigger) => void;
}): React.JSX.Element {
  const objectOptions: SelectOption[] = objects.map((o) => ({
    value: o.slug,
    label: o.labelPlural,
  }));

  const setEvent = (event: string | null): void => {
    if (!event) return;
    // Per-event extras don't survive an event swap; `object` does (harmless
    // for object-agnostic events, required for record.* / time.elapsed).
    onChange({ event, object: trigger.object });
  };

  /** Set (or clear, when empty) a flattened trigger extra. */
  const setExtra = (key: string, value: unknown): void => {
    const next: WorkflowTrigger = { ...trigger };
    if (value === undefined || value === null || value === '') delete next[key];
    else next[key] = value;
    onChange(next);
  };

  /** Set (or clear) a key under `trigger.config` (the scheduler's cron bag). */
  const setConfig = (key: string, value: unknown): void => {
    const cfg = { ...((trigger.config ?? {}) as Record<string, unknown>) };
    if (value === undefined || value === null || value === '') delete cfg[key];
    else cfg[key] = value;
    setExtra('config', Object.keys(cfg).length > 0 ? cfg : undefined);
  };

  const numInput = (key: string, label: string): React.JSX.Element => (
    <Field key={key} label={label}>
      <Input
        type="number"
        min={0}
        inputSize="sm"
        value={posNum(trigger[key]) || ''}
        onChange={(e) => setExtra(key, posNum(e.target.value) || undefined)}
      />
    </Field>
  );

  const isChanged =
    trigger.event === 'record.stage_changed' || trigger.event === 'record.status_changed';
  const cfg = (trigger.config ?? {}) as Record<string, unknown>;

  return (
    <>
      <Field label="When" required>
        <SelectField
          value={String(trigger.event)}
          onChange={setEvent}
          options={EVENT_OPTIONS}
          size="sm"
        />
      </Field>

      {eventNeedsObject(trigger.event) ? (
        <Field
          label="Object"
          required
          error={!trigger.object ? 'Pick the object this trigger watches.' : undefined}
        >
          <SelectField
            value={trigger.object ?? null}
            onChange={(v) => setExtra('object', v ?? undefined)}
            options={objectOptions}
            placeholder="Pick an object"
            size="sm"
            searchable
          />
        </Field>
      ) : null}

      {isChanged ? (
        <>
          <Field
            label="Watched field"
            help={`Defaults to ${trigger.event === 'record.stage_changed' ? '"stage"' : '"status"'}.`}
          >
            <Input
              inputSize="sm"
              value={str(trigger as Record<string, unknown>, 'field')}
              placeholder={trigger.event === 'record.stage_changed' ? 'stage' : 'status'}
              onChange={(e) => setExtra('field', e.target.value || undefined)}
            />
          </Field>
          <Field label="From value" help="Only fire when the old value matches (optional).">
            <Input
              inputSize="sm"
              value={str(trigger as Record<string, unknown>, 'fromValue')}
              onChange={(e) => setExtra('fromValue', e.target.value || undefined)}
            />
          </Field>
          <Field label="To value" help="Only fire when the new value matches (optional).">
            <Input
              inputSize="sm"
              value={str(trigger as Record<string, unknown>, 'toValue')}
              onChange={(e) => setExtra('toValue', e.target.value || undefined)}
            />
          </Field>
        </>
      ) : null}

      {trigger.event === 'time.elapsed' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {numInput('afterDays', 'Days')}
            {numInput('afterHours', 'Hours')}
            {numInput('afterMinutes', 'Minutes')}
          </div>
          {elapsedMinutes(trigger) <= 0 ? (
            <Alert tone="warning">Set an idle duration — 0 disables the trigger.</Alert>
          ) : (
            <p className="text-xs text-[var(--st-text-secondary)]">
              Fires once per record idle longer than {formatMinutes(elapsedMinutes(trigger))}.
            </p>
          )}
          <Field label="Since field" help={'Idle clock anchor. Defaults to "updatedAt".'}>
            <Input
              inputSize="sm"
              value={str(trigger as Record<string, unknown>, 'sinceField')}
              placeholder="updatedAt"
              onChange={(e) => setExtra('sinceField', e.target.value || undefined)}
            />
          </Field>
        </>
      ) : null}

      {trigger.event === 'cron' ? (
        <Field
          label="Every (minutes)"
          help="Run interval — evaluated by the 5-minute scheduler tick."
        >
          <Input
            type="number"
            min={0}
            inputSize="sm"
            value={posNum(cfg.intervalMinutes) || ''}
            onChange={(e) => setConfig('intervalMinutes', posNum(e.target.value) || undefined)}
          />
        </Field>
      ) : null}

      {trigger.event === 'manual' ? (
        <p className="text-xs text-[var(--st-text-secondary)]">
          Runs only when started with &quot;Run now&quot;.
        </p>
      ) : null}
      {trigger.event === 'webhook' ? (
        <p className="text-xs text-[var(--st-text-secondary)]">
          Fires when the engine receives the workflow&apos;s inbound webhook.
        </p>
      ) : null}
    </>
  );
}

// -- Step panel (conditions + per-type action forms) -------------------------

function StepPanel({
  step,
  objects,
  onConfig,
  onStep,
}: {
  step: WorkflowStep;
  objects: ObjectMetadata[];
  /** Set (or clear, when '') one `config` key. */
  onConfig: (key: string, value: unknown) => void;
  /** Patch step-level keys (`enabled`). */
  onStep: (patch: Partial<WorkflowStep>) => void;
}): React.JSX.Element {
  const c = step.config ?? {};
  const objectOptions: SelectOption[] = objects.map((o) => ({
    value: o.slug,
    label: o.labelPlural,
  }));

  const text = (
    key: string,
    label: string,
    opts: { required?: boolean; help?: string; placeholder?: string } = {},
  ): React.JSX.Element => (
    <Field
      key={key}
      label={label}
      required={opts.required}
      help={opts.help}
      error={opts.required && !str(c, key) ? `${label} is required.` : undefined}
    >
      <Input
        inputSize="sm"
        value={str(c, key)}
        placeholder={opts.placeholder}
        onChange={(e) => onConfig(key, e.target.value)}
      />
    </Field>
  );

  let body: React.ReactNode;
  switch (step.type) {
    case 'filter':
    case 'if_else': {
      const op = str(c, 'operator') || 'eq';
      body = (
        <>
          <p className="text-xs text-[var(--st-text-secondary)]">
            {step.type === 'filter'
              ? 'The run stops here unless the condition passes.'
              : 'The remaining steps run only when the condition is true (else: stop).'}
          </p>
          <Field
            label="Field"
            help="Dotted context path, e.g. trigger.stage or steps.find1.count."
            error={
              !FIELDLESS_OPERATORS.has(op) && !str(c, 'field')
                ? 'Field is required for this operator.'
                : undefined
            }
          >
            <Input
              inputSize="sm"
              value={str(c, 'field')}
              placeholder={
                op === 'in_stage' ? 'trigger.stage (default)' : 'trigger.email'
              }
              onChange={(e) => onConfig('field', e.target.value)}
            />
          </Field>
          <Field label="Operator">
            <SelectField
              value={op}
              onChange={(v) => onConfig('operator', v ?? 'eq')}
              options={OPERATOR_OPTIONS}
              size="sm"
            />
          </Field>
          {!NO_VALUE_OPERATORS.has(op)
            ? text('value', 'Value', {
                help:
                  op === 'in' || op === 'nin' || op === 'in_stage' || op === 'has_tag' || op === 'not_has_tag'
                    ? 'Comma-separated values are matched as a set.'
                    : '{{trigger.*}} variables are resolved at run time.',
              })
            : null}
        </>
      );
      break;
    }
    case 'create_task':
      body = (
        <>
          {text('title', 'Task title', { required: true, placeholder: 'Follow up with {{trigger.name}}' })}
          <Field label="Body">
            <Textarea
              rows={3}
              value={str(c, 'body')}
              onChange={(e) => onConfig('body', e.target.value)}
            />
          </Field>
        </>
      );
      break;
    case 'send_notification':
      body = (
        <>
          {text('title', 'Title', { placeholder: 'Workflow notification' })}
          <Field label="Body">
            <Textarea
              rows={3}
              value={str(c, 'body')}
              onChange={(e) => onConfig('body', e.target.value)}
            />
          </Field>
          {text('userId', 'Recipient user id', {
            help: 'Defaults to the acting user when empty.',
          })}
        </>
      );
      break;
    case 'update_field':
      body = (
        <>
          {text('field', 'Field', { required: true, placeholder: 'stage' })}
          {text('value', 'New value', { help: '{{trigger.*}} variables are resolved at run time.' })}
        </>
      );
      break;
    case 'webhook':
      body = (
        <>
          {text('url', 'URL', { required: true, placeholder: 'https://example.com/hook' })}
          <Field label="Payload" help="Forwarded as `payload` in the POST body (optional).">
            <Textarea
              rows={3}
              value={str(c, 'payload')}
              onChange={(e) => onConfig('payload', e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
        </>
      );
      break;
    case 'send_whatsapp_template':
      body = (
        <>
          {text('templateId', 'Template id', {
            required: true,
            help: 'WaChat template id (Templates → copy id).',
          })}
          {text('to', 'Recipient', {
            required: true,
            placeholder: '{{trigger.phone}}',
            help: 'Phone number — usually a {{trigger.*}} variable.',
          })}
          {text('mediaId', 'Header media id', { help: 'Optional WhatsApp media handle.' })}
          <JsonField
            key={`${step.id}-vars`}
            label="Variables"
            help="Named template variables (JSON object)."
            value={c.variables}
            onCommit={(v) => onConfig('variables', v)}
            placeholder={'{\n  "name": "{{trigger.name}}"\n}'}
          />
        </>
      );
      break;
    case 'find_records':
      body = (
        <>
          <Field label="Object" help="Defaults to the trigger object.">
            <SelectField
              value={str(c, 'object') || null}
              onChange={(v) => onConfig('object', v ?? '')}
              options={objectOptions}
              placeholder="Trigger object"
              size="sm"
              searchable
              clearable
            />
          </Field>
          {text('q', 'Search text', { help: 'Free-text query (optional).' })}
          <Field label="Limit">
            <Input
              type="number"
              min={0}
              inputSize="sm"
              value={posNum(c.limit) || ''}
              onChange={(e) => onConfig('limit', posNum(e.target.value) || '')}
            />
          </Field>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Later steps can read {'{{steps.'}{step.id}{'.records}}'} / {'{{steps.'}
            {step.id}{'.count}}'}.
          </p>
        </>
      );
      break;
    case 'upsert_record':
      body = (
        <>
          <Field label="Object" help="Defaults to the trigger object.">
            <SelectField
              value={str(c, 'object') || null}
              onChange={(v) => onConfig('object', v ?? '')}
              options={objectOptions}
              placeholder="Trigger object"
              size="sm"
              searchable
              clearable
            />
          </Field>
          {text('matchField', 'Match field', {
            help: 'Update the first record whose field matches; create otherwise.',
          })}
          {text('matchValue', 'Match value', { placeholder: '{{trigger.email}}' })}
          <JsonField
            key={`${step.id}-data`}
            label="Record data"
            help="Fields to write (JSON object)."
            value={c.data}
            onCommit={(v) => onConfig('data', v)}
            placeholder={'{\n  "email": "{{trigger.email}}"\n}'}
          />
        </>
      );
      break;
    default:
      body = (
        <Alert tone="warning">
          Unknown step type <code>{step.type}</code> — its config round-trips untouched.
        </Alert>
      );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--st-text-secondary)]">
          {STEP_META[step.type]?.blurb ?? ''}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
          Enabled
          <Switch
            checked={step.enabled !== false}
            size="sm"
            aria-label="Step enabled"
            onCheckedChange={(next) => onStep({ enabled: next ? undefined : false })}
          />
        </label>
      </div>
      {body}
    </>
  );
}

// -- Workflow panel (nothing selected) ----------------------------------------

function WorkflowPanel({
  draft,
  onChange,
  onToggleEnabled,
  onDelete,
}: {
  draft: Workflow;
  onChange: (next: Workflow) => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <>
      <Field label="Name" required error={!draft.name.trim() ? 'A name is required.' : undefined}>
        <Input
          inputSize="sm"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <Textarea
          rows={3}
          value={draft.description ?? ''}
          onChange={(e) => onChange({ ...draft, description: e.target.value || undefined })}
        />
      </Field>
      <div className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2">
        <span className="text-sm text-[var(--st-text)]">
          {draft.enabled ? 'Enabled' : 'Disabled'}
          <span className="block text-xs text-[var(--st-text-secondary)]">
            {draft.enabled ? 'The trigger is live.' : 'The trigger will not fire.'}
          </span>
        </span>
        <Switch
          checked={draft.enabled}
          aria-label={draft.enabled ? 'Disable workflow' : 'Enable workflow'}
          onCheckedChange={onToggleEnabled}
        />
      </div>
      <p className="text-xs text-[var(--st-text-secondary)]">
        Select a node on the canvas to configure the trigger or a step.
      </p>
      <Button variant="ghost" iconLeft={Trash2} onClick={onDelete} className="self-start text-[var(--st-danger)]">
        Delete workflow
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Run history (runs tab)
// ---------------------------------------------------------------------------

function RunStatusBadge({ status }: { status: RunStatus }): React.JSX.Element {
  const bucket = statusBucket(status);
  const Icon = STATUS_ICON[bucket];
  return (
    <Badge tone={STATUS_TONE[bucket]} kind="soft">
      <Icon
        size={12}
        className={bucket === 'run' ? 'animate-spin' : undefined}
        aria-hidden="true"
      />
      {STATUS_LABEL[bucket]}
    </Badge>
  );
}

function RunHistory({
  runs,
  loading,
  error,
  onRefresh,
}: {
  runs: WorkflowRun[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-2.5">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <History size={13} aria-hidden="true" />
          Run history
        </CardTitle>
        <IconButton
          label="Refresh run history"
          icon={RefreshCw}
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className={loading ? 'animate-spin' : undefined}
        />
      </CardHeader>
      <CardBody className="p-0">
        {error ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">{error}</p>
        ) : loading && runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
            Loading runs.
          </p>
        ) : runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
            No runs yet. Use &quot;Run now&quot; to fire this workflow.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {runs.map((run) => {
              const isOpen = expanded.has(run.id);
              const started = relativeTimeFrom(run.startedAt);
              const finished = relativeTimeFrom(run.finishedAt);
              return (
                <li key={run.id}>
                  <Button
                    variant="ghost"
                    block
                    aria-expanded={isOpen}
                    onClick={() => toggle(run.id)}
                    className="!justify-start gap-2.5 rounded-none px-4 py-2.5 text-left [&>.u-btn__label]:flex [&>.u-btn__label]:w-full [&>.u-btn__label]:items-center [&>.u-btn__label]:gap-2.5"
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-[var(--st-text-tertiary)] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <RunStatusBadge status={run.status} />
                    <span className="flex-1 truncate text-xs text-[var(--st-text-secondary)]">
                      {started ? `Started ${started}` : 'Started recently'}
                      {finished ? ` · Finished ${finished}` : ''}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--st-text-tertiary)]">
                      {run.steps.length} {run.steps.length === 1 ? 'step' : 'steps'}
                    </span>
                  </Button>
                  {isOpen ? (
                    <div className="bg-[var(--st-bg-secondary)] px-4 py-2">
                      {run.steps.length === 0 ? (
                        <p className="py-1 text-xs text-[var(--st-text-tertiary)]">
                          No step records.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {run.steps.map((s, i) => (
                            <li key={s.id || i} className="flex items-center gap-2 text-xs">
                              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--st-border)] px-1 text-[10px] font-semibold text-[var(--st-text-secondary)]">
                                {i + 1}
                              </span>
                              <span className="text-[var(--st-text)]">
                                {STEP_META[s.type]?.label ?? s.type}
                              </span>
                              <RunStatusBadge status={s.status} />
                              {s.error ? (
                                <span
                                  className="truncate text-[var(--st-danger)]"
                                  title={s.error}
                                >
                                  {s.error}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Editor (right pane): toolbar + canvas/panel grid + runs tab
// ---------------------------------------------------------------------------

/** Outcome of the most recent "Run now" click, surfaced inline + transiently. */
type RunNote = { kind: 'ok' | 'err'; message: string };

type EditorTab = 'canvas' | 'runs';

const TAB_OPTIONS: ReadonlyArray<SegmentedItem<EditorTab>> = [
  { value: 'canvas', label: 'Canvas', icon: WorkflowIcon },
  { value: 'runs', label: 'Runs', icon: History },
];

interface EditorProps {
  draft: Workflow;
  baseline: Workflow;
  objects: ObjectMetadata[];
  saving: boolean;
  running: boolean;
  runNote: RunNote | null;
  runs: WorkflowRun[];
  runsLoading: boolean;
  runsError: string | null;
  tab: EditorTab;
  selectedNodeId: string | null;
  onTabChange: (tab: EditorTab) => void;
  onSelectNode: (id: string | null) => void;
  onRefreshRuns: () => void;
  onChange: (next: Workflow) => void;
  onSave: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onRun: () => void;
}

function Editor({
  draft,
  baseline,
  objects,
  saving,
  running,
  runNote,
  runs,
  runsLoading,
  runsError,
  tab,
  selectedNodeId,
  onTabChange,
  onSelectNode,
  onRefreshRuns,
  onChange,
  onSave,
  onToggleEnabled,
  onDelete,
  onRun,
}: EditorProps): React.JSX.Element {
  const dirty = !sameWorkflow(draft, baseline);
  /** A draft is runnable when it exists server-side and has no pending edits. */
  const runnable = !dirty && !saving;
  const lastRun = relativeTimeFrom(draft.lastRunAt);

  const flowNodes = React.useMemo(() => workflowFlowNodes(draft), [draft]);
  const selectedStep =
    selectedNodeId && selectedNodeId !== TRIGGER_NODE_ID
      ? draft.steps.find((s) => s.id === selectedNodeId) ?? null
      : null;
  const selectedIndex = selectedStep ? draft.steps.indexOf(selectedStep) : -1;

  // -- step edit helpers ----------------------------------------------------
  const patchStep = (id: string, patch: Partial<WorkflowStep>): void =>
    onChange({
      ...draft,
      steps: draft.steps.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // `enabled: undefined` means "back to default" — drop the key.
        if (patch.enabled === undefined && 'enabled' in patch) delete next.enabled;
        return next;
      }),
    });

  const patchStepConfig = (id: string, key: string, value: unknown): void =>
    onChange({
      ...draft,
      steps: draft.steps.map((s) => {
        if (s.id !== id) return s;
        const config = { ...(s.config ?? {}) };
        if (value === undefined || value === '') delete config[key];
        else config[key] = value;
        return { ...s, config };
      }),
    });

  const addStep = (type: StepType): void => {
    const step: WorkflowStep = { id: newStepId(), type, config: {} };
    onChange({ ...draft, steps: [...draft.steps, step] });
    onSelectNode(step.id);
  };

  const moveStep = (id: string, dir: -1 | 1): void => {
    const i = draft.steps.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    onChange({ ...draft, steps });
  };

  const removeStep = (id: string): void => {
    onChange({ ...draft, steps: draft.steps.filter((s) => s.id !== id) });
    if (selectedNodeId === id) onSelectNode(null);
  };

  /** On-canvas deletion: the canvas emits the surviving ordered node ids. */
  const handleCanvasChange = (orderedIds: string[]): void => {
    const keep = new Set(orderedIds);
    onChange({ ...draft, steps: draft.steps.filter((s) => keep.has(s.id)) });
    if (selectedNodeId && selectedNodeId !== TRIGGER_NODE_ID && !keep.has(selectedNodeId)) {
      onSelectNode(null);
    }
  };

  // -- config panel routing ---------------------------------------------------
  let panel: React.JSX.Element;
  if (selectedNodeId === TRIGGER_NODE_ID) {
    panel = (
      <PanelShell icon={Zap} title="Trigger">
        <TriggerPanel
          trigger={draft.trigger}
          objects={objects}
          onChange={(trigger) => onChange({ ...draft, trigger })}
        />
      </PanelShell>
    );
  } else if (selectedStep) {
    const meta = STEP_META[selectedStep.type];
    panel = (
      <PanelShell
        icon={meta?.icon ?? Zap}
        title={`${meta?.label ?? selectedStep.type} — step ${selectedIndex + 1} of ${draft.steps.length}`}
        actions={
          <span className="flex items-center gap-1">
            <IconButton
              label="Move step up"
              icon={ArrowUp}
              size="sm"
              disabled={selectedIndex <= 0}
              onClick={() => moveStep(selectedStep.id, -1)}
            />
            <IconButton
              label="Move step down"
              icon={ArrowDown}
              size="sm"
              disabled={selectedIndex >= draft.steps.length - 1}
              onClick={() => moveStep(selectedStep.id, 1)}
            />
            <IconButton
              label="Remove step"
              icon={Trash2}
              size="sm"
              onClick={() => removeStep(selectedStep.id)}
            />
          </span>
        }
      >
        <StepPanel
          key={selectedStep.id}
          step={selectedStep}
          objects={objects}
          onConfig={(key, value) => patchStepConfig(selectedStep.id, key, value)}
          onStep={(patch) => patchStep(selectedStep.id, patch)}
        />
      </PanelShell>
    );
  } else {
    panel = (
      <PanelShell icon={Settings2} title="Workflow">
        <WorkflowPanel
          draft={draft}
          onChange={onChange}
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
        />
      </PanelShell>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          items={TAB_OPTIONS}
          value={tab}
          onChange={onTabChange}
          size="sm"
          aria-label="Editor view"
        />
        {tab === 'canvas' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" iconLeft={Plus}>
                Add step
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Conditions</DropdownMenuLabel>
              {Object.entries(STEP_META)
                .filter(([, m]) => m.kind === 'condition')
                .map(([type, m]) => (
                  <DropdownMenuItem key={type} onSelect={() => addStep(type)}>
                    <m.icon size={14} aria-hidden="true" />
                    {m.label}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {Object.entries(STEP_META)
                .filter(([, m]) => m.kind === 'action')
                .map(([type, m]) => (
                  <DropdownMenuItem key={type} onSelect={() => addStep(type)}>
                    <m.icon size={14} aria-hidden="true" />
                    {m.label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <span className="flex-1" />
        {dirty ? (
          <Badge tone="warning" kind="soft">
            Unsaved changes
          </Badge>
        ) : (
          <Badge tone="success" kind="soft">
            Saved
          </Badge>
        )}
        {lastRun ? (
          <span
            className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]"
            title="Last run"
          >
            <History size={12} aria-hidden="true" />
            Last run: {lastRun}
          </span>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          iconLeft={running ? undefined : Play}
          loading={running}
          disabled={!runnable || running}
          onClick={onRun}
          title={runnable ? 'Run this workflow now' : 'Save your changes before running'}
        >
          {running ? 'Running' : 'Run now'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Save}
          loading={saving}
          disabled={!dirty || saving}
          onClick={onSave}
        >
          {saving ? 'Saving' : 'Save'}
        </Button>
      </div>

      {runNote ? (
        <Alert tone={runNote.kind === 'ok' ? 'success' : 'danger'}>{runNote.message}</Alert>
      ) : null}

      {tab === 'canvas' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AutomationCanvas
            className="h-[560px]"
            nodes={flowNodes}
            selectedId={selectedNodeId}
            onNodeSelect={onSelectNode}
            onChange={handleCanvasChange}
            aria-label={`Flow canvas for ${draft.name || 'workflow'}`}
          />
          {panel}
        </div>
      ) : (
        <RunHistory
          runs={runs}
          loading={runsLoading}
          error={runsError}
          onRefresh={onRefreshRuns}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  workflow: Workflow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({
  workflow,
  busy,
  onCancel,
  onConfirm,
}: DeleteDialogProps): React.JSX.Element {
  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong className="text-[var(--st-text)]">{workflow.name || 'this workflow'}</strong>?
            Its trigger will stop firing and its steps will no longer run. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            intent="danger"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? 'Deleting' : 'Delete workflow'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (left list)
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={52} radius="var(--st-radius)" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmWorkflowsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  /** Server-known state of the selected workflow (the "baseline" for dirty). */
  const [baseline, setBaseline] = React.useState<Workflow | null>(null);
  /** Locally-edited draft of the selected workflow. */
  const [draft, setDraft] = React.useState<Workflow | null>(null);
  /** Selected canvas node (trigger sentinel / step id) for the config panel. */
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  /** Canvas vs runs tab of the editor. */
  const [tab, setTab] = React.useState<EditorTab>('canvas');

  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Workflow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  /** "Run now" state for the selected workflow (one at a time). */
  const [running, setRunning] = React.useState(false);
  const [runNote, setRunNote] = React.useState<RunNote | null>(null);

  /** Run history for the selected workflow. */
  const [runs, setRuns] = React.useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = React.useState(false);
  const [runsError, setRunsError] = React.useState<string | null>(null);
  /** Timer that clears the transient note; cleared on unmount/re-run. */
  const runNoteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (runNoteTimer.current) clearTimeout(runNoteTimer.current);
    },
    [],
  );

  // -- Load list + objects -------------------------------------------------
  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [wfRes, objRes] = await Promise.all([
        listWorkflowsTw(projectId),
        listObjectsTw(projectId),
      ]);
      if (!wfRes.ok) {
        setError(wfRes.error);
        setWorkflows([]);
        return;
      }
      setWorkflows(wfRes.data as unknown as Workflow[]);
      if (objRes.ok) setObjects(objRes.data);
    } catch {
      setError('Workflows could not be loaded. The service may be unavailable.');
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    void load(activeProjectId);
  }, [activeProjectId, isLoadingProject, load]);

  // -- Load run history for a workflow (best-effort, normalised) ----------
  const loadRuns = React.useCallback(
    async (workflowId: string) => {
      if (!activeProjectId) return;
      setRunsLoading(true);
      setRunsError(null);
      try {
        const res = await listWorkflowRunsTw(workflowId);
        if (res.ok) {
          setRuns((res.data as WorkflowRun[]) ?? []);
        } else {
          setRuns([]);
          setRunsError(res.error || 'Run history is unavailable.');
        }
      } catch {
        setRuns([]);
        setRunsError('Run history could not be loaded. The service may be unavailable.');
      } finally {
        setRunsLoading(false);
      }
    },
    [activeProjectId],
  );

  // -- Select a workflow -> fetch its full detail (steps/trigger) ----------
  const select = React.useCallback(
    async (workflow: Workflow, intoTab: EditorTab = 'canvas') => {
      setSelectedId(workflow.id);
      setTab(intoTab);
      setSelectedNodeId(null);
      // Switching workflows clears any stale run note from the previous one.
      if (runNoteTimer.current) clearTimeout(runNoteTimer.current);
      setRunNote(null);
      // Seed immediately from the list row so the pane is never blank.
      setBaseline(workflow);
      setDraft(workflow);
      // Fresh run history for the newly-selected workflow.
      setRuns([]);
      void loadRuns(workflow.id);
      if (!activeProjectId) return;
      try {
        const res = await getWorkflowTw(workflow.id, activeProjectId);
        if (res.ok) {
          const full = res.data as unknown as Workflow;
          setBaseline(full);
          // Only overwrite the draft if the user hasn't started editing.
          setDraft((prev) =>
            prev && prev.id === full.id && sameWorkflow(prev, workflow) ? full : prev,
          );
          setWorkflows((prev) => prev.map((w) => (w.id === full.id ? full : w)));
        }
      } catch {
        /* keep the list-seeded version; non-fatal */
      }
    },
    [activeProjectId, loadRuns],
  );

  // -- Create -------------------------------------------------------------
  const handleCreate = React.useCallback(async () => {
    if (!activeProjectId || creating) return;
    setCreating(true);
    setError(null);
    const input: CreateInput = {
      name: 'Untitled workflow',
      enabled: false,
      trigger: { event: 'record.created', object: '' },
      steps: [],
    };
    try {
      const res = await createWorkflowTw(input, activeProjectId);
      if (res.ok) {
        const created = res.data as unknown as Workflow;
        setWorkflows((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setBaseline(created);
        setDraft(created);
        setTab('canvas');
        // Land the author on the trigger config — the natural first edit.
        setSelectedNodeId(TRIGGER_NODE_ID);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Failed to create the workflow. The service may be unavailable.');
    } finally {
      setCreating(false);
    }
  }, [activeProjectId, creating]);

  // -- Save (persist the draft) -------------------------------------------
  const handleSave = React.useCallback(async () => {
    if (!activeProjectId || !draft || saving) return;
    if (!draft.name.trim()) {
      setError('Workflow name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const patch: WorkflowPatch = {
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      enabled: draft.enabled,
      trigger: draft.trigger,
      steps: draft.steps,
    };
    try {
      const res = await updateWorkflowTw(draft.id, patch, activeProjectId);
      if (res.ok) {
        const saved = res.data as unknown as Workflow;
        setBaseline(saved);
        setDraft(saved);
        setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
        toast({ title: 'Workflow saved' });
      } else {
        setError(res.error);
      }
    } catch {
      setError('Failed to save the workflow. The service may be unavailable.');
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, draft, saving, toast]);

  // -- Toggle enabled (persists immediately, optimistic) ------------------
  const handleToggleEnabled = React.useCallback(
    async (workflow: Workflow) => {
      if (!activeProjectId) return;
      const next = !workflow.enabled;
      // Optimistic update across list + draft/baseline.
      setWorkflows((prev) => prev.map((w) => (w.id === workflow.id ? { ...w, enabled: next } : w)));
      setDraft((prev) => (prev && prev.id === workflow.id ? { ...prev, enabled: next } : prev));
      setBaseline((prev) => (prev && prev.id === workflow.id ? { ...prev, enabled: next } : prev));
      try {
        const res = await updateWorkflowTw(workflow.id, { enabled: next }, activeProjectId);
        if (res.ok) {
          const saved = res.data as unknown as Workflow;
          setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
          setBaseline((prev) => (prev && prev.id === saved.id ? { ...prev, enabled: saved.enabled } : prev));
          setDraft((prev) => (prev && prev.id === saved.id ? { ...prev, enabled: saved.enabled } : prev));
        } else {
          // revert
          setWorkflows((prev) =>
            prev.map((w) => (w.id === workflow.id ? { ...w, enabled: workflow.enabled } : w)),
          );
          setDraft((prev) =>
            prev && prev.id === workflow.id ? { ...prev, enabled: workflow.enabled } : prev,
          );
          setBaseline((prev) =>
            prev && prev.id === workflow.id ? { ...prev, enabled: workflow.enabled } : prev,
          );
          setError(res.error);
        }
      } catch {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === workflow.id ? { ...w, enabled: workflow.enabled } : w)),
        );
        setError('Failed to update the workflow. The service may be unavailable.');
      }
    },
    [activeProjectId],
  );

  // -- Delete -------------------------------------------------------------
  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteWorkflowTw(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
        if (selectedId === deleteTarget.id) {
          setSelectedId(null);
          setDraft(null);
          setBaseline(null);
          setSelectedNodeId(null);
        }
        setDeleteTarget(null);
        toast({ title: 'Workflow deleted' });
      } else {
        setError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setError('Failed to delete the workflow. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId, selectedId, toast]);

  // -- Run now (manual one-off execution of a saved workflow) -------------
  const handleRunNow = React.useCallback(
    async (workflow: Workflow) => {
      if (!activeProjectId || running) return;
      if (runNoteTimer.current) clearTimeout(runNoteTimer.current);
      setRunNote(null);
      setRunning(true);
      const showNote = (note: RunNote): void => {
        setRunNote(note);
        runNoteTimer.current = setTimeout(() => setRunNote(null), 4000);
      };
      try {
        const res = await runWorkflowNowTw(workflow.id, activeProjectId);
        if (res.ok) {
          showNote({ kind: 'ok', message: res.data.ran ? 'Workflow ran' : 'Nothing to run' });
          // Optimistically stamp lastRunAt so the header/list reflect the run.
          const stampedAt = new Date().toISOString();
          setWorkflows((prev) =>
            prev.map((w) => (w.id === workflow.id ? { ...w, lastRunAt: stampedAt } : w)),
          );
          setBaseline((prev) =>
            prev && prev.id === workflow.id ? { ...prev, lastRunAt: stampedAt } : prev,
          );
          setDraft((prev) =>
            prev && prev.id === workflow.id ? { ...prev, lastRunAt: stampedAt } : prev,
          );
          // Pull the fresh run record into the history panel.
          void loadRuns(workflow.id);
        } else {
          showNote({ kind: 'err', message: res.error || 'Run failed' });
        }
      } catch {
        showNote({ kind: 'err', message: 'Run failed. The service may be unavailable.' });
      } finally {
        setRunning(false);
      }
    },
    [activeProjectId, running, loadRuns],
  );

  const enabledCount = workflows.filter((w) => w.enabled).length;

  return (
    <div className="20ui mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <WorkflowIcon size={20} aria-hidden="true" />
            Workflows
          </PageTitle>
          <PageDescription>
            Build event-driven workflows on the flow canvas: a trigger fires when a CRM
            record changes (or on a timer), then runs an ordered chain of steps. Managing
            workflows requires the{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-[0.85em] text-[var(--st-text)]">
              sabcrm:admin
            </code>{' '}
            capability.
            {workflows.length > 0 ? (
              <>
                {' '}
                {enabledCount} of {workflows.length}{' '}
                {workflows.length === 1 ? 'workflow' : 'workflows'} enabled.
              </>
            ) : null}
          </PageDescription>
        </PageHeaderHeading>
        {activeProjectId ? (
          <PageActions>
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => void handleCreate()}
              loading={creating}
            >
              {creating ? 'Creating' : 'New workflow'}
            </Button>
          </PageActions>
        ) : null}
      </PageHeader>

      {error ? (
        <Alert tone="danger" icon={AlertTriangle}>
          {error}
        </Alert>
      ) : null}

      {isLoadingProject || loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card padding="none" className="overflow-hidden">
            <ListSkeleton />
          </Card>
          <EmptyState
            icon={WorkflowIcon}
            title="Loading workflows."
            description="Fetching your event-driven workflows."
          />
        </div>
      ) : !activeProjectId ? (
        <EmptyState
          icon={AlertTriangle}
          tone="warning"
          title="No project selected"
          description="Select a project to manage its workflows."
        />
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Create your first workflow to automatically run steps — create tasks, send notifications or WhatsApp templates, update fields, or call webhooks — when CRM events occur."
          action={
            <Button
              variant="secondary"
              iconLeft={Plus}
              onClick={() => void handleCreate()}
              loading={creating}
            >
              New workflow
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Left: list */}
          <Card padding="none" className="self-start overflow-hidden">
            <CardHeader className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-2.5">
              <CardTitle className="text-sm">Workflows</CardTitle>
              <Badge tone="neutral" kind="soft">
                {workflows.length}
              </Badge>
            </CardHeader>
            <CardBody className="max-h-[70vh] overflow-y-auto p-2">
              <ul className="flex flex-col gap-1">
                {workflows.map((w) => {
                  const active = w.id === selectedId;
                  const last = relativeTimeFrom(w.lastRunAt);
                  const meta = EVENT_META[w.trigger.event];
                  return (
                    <li
                      key={w.id}
                      className={`rounded-[var(--st-radius)] border ${
                        active
                          ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                          : 'border-transparent'
                      }`}
                    >
                      <Button
                        variant="ghost"
                        block
                        onClick={() => void select(w)}
                        title="Edit workflow"
                        className="!justify-start rounded-[var(--st-radius)] rounded-b-none px-3 pb-1 pt-2.5 text-left [&>.u-btn__label]:flex [&>.u-btn__label]:w-full [&>.u-btn__label]:flex-col [&>.u-btn__label]:items-start [&>.u-btn__label]:gap-1"
                      >
                        <span className="w-full truncate text-sm font-medium text-[var(--st-text)]">
                          {w.name || 'Untitled workflow'}
                        </span>
                        <span className="flex w-full items-center gap-1.5">
                          <Badge tone={meta?.tone ?? 'neutral'} kind="soft">
                            {eventLabel(w.trigger.event)}
                          </Badge>
                          {last ? (
                            <span className="truncate text-xs text-[var(--st-text-tertiary)]">
                              {last}
                            </span>
                          ) : null}
                        </span>
                      </Button>
                      <span className="flex items-center gap-1 px-3 pb-2 pt-0.5">
                        <Switch
                          checked={w.enabled}
                          size="sm"
                          aria-label={w.enabled ? 'Disable workflow' : 'Enable workflow'}
                          title={w.enabled ? 'Enabled' : 'Disabled'}
                          onCheckedChange={() => void handleToggleEnabled(w)}
                        />
                        <span className="flex-1" />
                        <IconButton
                          label={`Edit ${w.name || 'workflow'}`}
                          icon={PenLine}
                          size="sm"
                          onClick={() => void select(w)}
                        />
                        <IconButton
                          label={`Runs of ${w.name || 'workflow'}`}
                          icon={History}
                          size="sm"
                          onClick={() => void select(w, 'runs')}
                        />
                        <IconButton
                          label={`Delete ${w.name || 'workflow'}`}
                          icon={Trash2}
                          size="sm"
                          onClick={() => setDeleteTarget(w)}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

          {/* Right: editor (canvas + config panel / runs) */}
          {draft && baseline ? (
            <Editor
              draft={draft}
              baseline={baseline}
              objects={objects}
              saving={saving}
              running={running}
              runNote={runNote}
              runs={runs}
              runsLoading={runsLoading}
              runsError={runsError}
              tab={tab}
              selectedNodeId={selectedNodeId}
              onTabChange={setTab}
              onSelectNode={setSelectedNodeId}
              onRefreshRuns={() => void loadRuns(draft.id)}
              onChange={setDraft}
              onSave={() => void handleSave()}
              onToggleEnabled={() => void handleToggleEnabled(draft)}
              onDelete={() => setDeleteTarget(draft)}
              onRun={() => void handleRunNow(draft)}
            />
          ) : (
            <EmptyState
              icon={WorkflowIcon}
              title="No workflow selected"
              description="Select a workflow to edit it on the canvas, or create a new one."
            />
          )}
        </div>
      )}

      {deleteTarget ? (
        <DeleteDialog
          workflow={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
