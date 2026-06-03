'use client';

/**
 * SabCRM Settings — Workflows (`/sabcrm/settings/automations`), Twenty-style.
 *
 * A Twenty-faithful WORKFLOW builder: a vertical "flow" of a single trigger
 * followed by ordered steps. The left pane lists every workflow (name, enabled
 * toggle, trigger summary); the right pane is the builder for the selected one:
 *
 *   - Trigger card  → event select + object select.
 *   - Steps flow    → connector-linked cards, each with a small per-type config
 *                     form (create_task / send_notification / update_field /
 *                     webhook / filter / if_else / find_records / upsert_record).
 *                     Add (type picker), remove, and reorder (up/down).
 *
 * Advanced authoring layered on top:
 *   - Variable picker  → text inputs carry a `{{}}` button that inserts
 *                        `{{trigger.…}}` / `{{record.…}}` / `{{steps.<id>.…}}`
 *                        tokens chosen from a grouped dropdown (`VarInput`).
 *   - Diagram view     → a "Builder" / "Diagram" toggle renders the trigger +
 *                        steps as a read-only vertical flowchart (pure CSS/SVG
 *                        connectors) with True/Else branch hints for if_else.
 *   - Run history      → `listWorkflowRunsTw(id)` lists past runs with a status
 *                        chip, relative started/finished times, and expandable
 *                        per-step status; refreshed after every Run-now.
 *
 * Wired to the workflows engine through the gated server actions in
 * `@/app/actions/sabcrm-workflows.actions` (list / get / create / update /
 * delete), `runWorkflowNowTw` (manual run) and `listWorkflowRunsTw` (history).
 * Object + field pickers read `listObjectsTw` from
 * `@/app/actions/sabcrm-objects.actions`. The engine may be DOWN at dev time —
 * every call is normalised to `{ ok, ... }` and the UI degrades to graceful
 * loading / empty / error states and never crashes.
 *
 * Twenty visual language only (`.st-*` from sabcrm-twenty.css + new `wf-*`
 * classes in `./workflows.css`, `./run-now.css` and `./workflow-advanced.css`).
 * No ZoruUI, no Tailwind. The `.sabcrm-twenty` scope is applied by
 * TwentyAppFrame. Auth / project / RBAC guards are enforced upstream by the
 * layout and re-checked inside each server action.
 */

import * as React from 'react';
import {
  Zap,
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ClipboardList,
  Bell,
  Webhook,
  PenLine,
  Workflow as WorkflowIcon,
  Save,
  Play,
  Loader2,
  Check,
  History,
  Braces,
  Filter as FilterIcon,
  GitBranch,
  Search,
  RefreshCw,
  CircleDot,
  CircleCheck,
  CircleX,
  ChevronRight,
  LayoutList,
  Share2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
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

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './workflows.css';
import './run-now.css';
import './workflow-advanced.css';

// ---------------------------------------------------------------------------
// Local types (mirrors the workflow shape exposed by the engine actions; kept
// local so this client page never pulls a `server-only` guard into the bundle).
// ---------------------------------------------------------------------------

type TriggerEvent = 'record.created' | 'record.updated' | 'record.deleted';
type StepType =
  | 'create_task'
  | 'send_notification'
  | 'update_field'
  | 'webhook'
  | 'filter'
  | 'if_else'
  | 'find_records'
  | 'upsert_record';

interface WorkflowTrigger {
  event: TriggerEvent;
  object: string;
}

interface WorkflowStep {
  id: string;
  type: StepType;
  config: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  /** ISO timestamp (or epoch ms) of the last execution, when the engine reports it. */
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

const EVENT_OPTIONS: ReadonlyArray<{ value: TriggerEvent; label: string }> = [
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.updated', label: 'Record Updated' },
  { value: 'record.deleted', label: 'Record Deleted' },
];

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_OPTIONS.map((e) => [e.value, e.label]),
);

const STEP_META: Record<
  StepType,
  { label: string; icon: React.ComponentType<{ size?: number }>; blurb: string }
> = {
  create_task: { label: 'Create Task', icon: ClipboardList, blurb: 'Add a task' },
  send_notification: { label: 'Send Notification', icon: Bell, blurb: 'Notify a user' },
  update_field: { label: 'Update Field', icon: PenLine, blurb: 'Set a field value' },
  webhook: { label: 'Webhook', icon: Webhook, blurb: 'Call an external URL' },
  filter: { label: 'Filter', icon: FilterIcon, blurb: 'Stop unless conditions pass' },
  if_else: { label: 'If / Else', icon: GitBranch, blurb: 'Branch on a condition' },
  find_records: { label: 'Find Records', icon: Search, blurb: 'Query matching records' },
  upsert_record: { label: 'Upsert Record', icon: RefreshCw, blurb: 'Update or create a record' },
};

const STEP_ORDER: StepType[] = [
  'create_task',
  'send_notification',
  'update_field',
  'webhook',
  'filter',
  'if_else',
  'find_records',
  'upsert_record',
];

/** Comparison operators shared by Filter and If/Else condition rows. */
const OPERATOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

/** Operators that don't take a right-hand value. */
const VALUELESS_OPERATORS = new Set(['is_empty', 'is_not_empty']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v : '';
}

function emptyStep(type: StepType): WorkflowStep {
  return { id: newId('step'), type, config: {} };
}

function triggerSummary(t: WorkflowTrigger): string {
  const ev = EVENT_LABEL[t.event] ?? t.event;
  return t.object ? `${ev} on ${t.object}` : `${ev} on all objects`;
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

const STATUS_ICON: Record<'ok' | 'fail' | 'run' | 'wait', React.ComponentType<{ size?: number }>> = {
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

// ---------------------------------------------------------------------------
// Variable references (the `{{…}}` token picker)
// ---------------------------------------------------------------------------

interface VarLeaf {
  /** The token inserted into the input, e.g. `{{trigger.record.id}}`. */
  token: string;
  /** Human label shown in the dropdown. */
  label: string;
}

interface VarGroup {
  source: string;
  leaves: VarLeaf[];
}

/**
 * Builds the available `{{…}}` reference tree for a step at `stepIndex`:
 *   - trigger.record.<field> (+ id / createdAt)
 *   - record.<field>          (alias of the trigger record)
 *   - steps.<id>.<…>          (output of every PRIOR step)
 * Field names come from the trigger object's metadata when known.
 */
function buildVariableGroups(
  draft: Workflow,
  stepIndex: number,
  objects: ObjectMetadata[],
): VarGroup[] {
  const obj = objects.find((o) => o.slug === draft.trigger.object);
  const fields = obj?.fields.filter((f) => !f.system) ?? [];
  const recordLeaves: VarLeaf[] = [
    { token: '{{trigger.record.id}}', label: 'record.id' },
    ...fields.map((f) => ({
      token: `{{trigger.record.${f.key}}}`,
      label: `record.${f.label}`,
    })),
  ];

  const groups: VarGroup[] = [
    {
      source: 'Trigger',
      leaves: [
        { token: '{{trigger.event}}', label: 'event name' },
        { token: '{{trigger.object}}', label: 'object slug' },
        ...recordLeaves,
      ],
    },
    {
      source: 'Record (shortcut)',
      leaves: [
        { token: '{{record.id}}', label: 'record.id' },
        ...fields.map((f) => ({ token: `{{record.${f.key}}}`, label: `record.${f.label}` })),
      ],
    },
  ];

  // Every prior step exposes a generic output reference.
  const priorSteps = draft.steps.slice(0, stepIndex);
  if (priorSteps.length > 0) {
    groups.push({
      source: 'Previous steps',
      leaves: priorSteps.map((s, i) => ({
        token: `{{steps.${s.id}.output}}`,
        label: `${i + 1}. ${STEP_META[s.type]?.label ?? s.type} → output`,
      })),
    });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Step config form (per type)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Variable-aware text input ({{}} button + reference dropdown)
// ---------------------------------------------------------------------------

interface VarInputProps {
  id: string;
  value: string;
  placeholder?: string;
  type?: string;
  groups: VarGroup[];
  onChange: (value: string) => void;
}

/**
 * A `.st-input` wrapped with a small "{{}}" trigger. Clicking a reference from
 * the dropdown inserts the token at the caret (or appends it), preserving any
 * text the user has already typed. Read-only chrome — no engine call here.
 */
function VarInput({
  id,
  value,
  placeholder,
  type = 'text',
  groups,
  onChange,
}: VarInputProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const insert = (token: string) => {
    const el = inputRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = value.slice(0, start) + token + value.slice(end);
      onChange(next);
      // Restore caret just after the inserted token on the next frame.
      const caret = start + token.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    } else {
      onChange(value ? `${value}${token}` : token);
    }
    setOpen(false);
  };

  return (
    <div className="wf-varinput" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        className="st-input wf-varinput__field"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="wf-varinput__btn"
        aria-label="Insert a variable reference"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Insert variable"
        onClick={() => setOpen((v) => !v)}
      >
        <Braces size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div className="wf-varmenu" role="menu" aria-label="Available variables">
          {groups.every((g) => g.leaves.length === 0) ? (
            <div className="wf-varmenu__empty">No references available yet.</div>
          ) : (
            groups.map((g) =>
              g.leaves.length === 0 ? null : (
                <div key={g.source} className="wf-varmenu__group">
                  <div className="wf-varmenu__group-head">{g.source}</div>
                  {g.leaves.map((leaf) => (
                    <button
                      key={leaf.token}
                      type="button"
                      role="menuitem"
                      className="wf-varmenu__opt"
                      onClick={() => insert(leaf.token)}
                      title={leaf.token}
                    >
                      <span className="wf-varmenu__opt-label">{leaf.label}</span>
                      <code className="wf-varmenu__opt-token">{leaf.token}</code>
                    </button>
                  ))}
                </div>
              ),
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

interface StepConfigProps {
  step: WorkflowStep;
  index: number;
  draft: Workflow;
  objects: ObjectMetadata[];
  triggerObject: string;
  onPatch: (config: Record<string, unknown>) => void;
}

function StepConfig({
  step,
  index,
  draft,
  objects,
  triggerObject,
  onPatch,
}: StepConfigProps): React.JSX.Element {
  const set = (key: string, value: string) => onPatch({ ...step.config, [key]: value });
  // References available to THIS step (trigger + all prior steps).
  const groups = React.useMemo(
    () => buildVariableGroups(draft, index, objects),
    [draft, index, objects],
  );

  if (step.type === 'create_task') {
    return (
      <div className="st-field">
        <label className="st-field__label" htmlFor={`${step.id}-title`}>
          Task title
        </label>
        <VarInput
          id={`${step.id}-title`}
          value={str(step.config, 'title')}
          placeholder="e.g. Follow up with new lead"
          groups={groups}
          onChange={(v) => set('title', v)}
        />
      </div>
    );
  }

  if (step.type === 'send_notification') {
    return (
      <>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-ntitle`}>
            Title
          </label>
          <VarInput
            id={`${step.id}-ntitle`}
            value={str(step.config, 'title')}
            placeholder="Notification title"
            groups={groups}
            onChange={(v) => set('title', v)}
          />
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-nbody`}>
            Body
          </label>
          <textarea
            id={`${step.id}-nbody`}
            className="st-textarea"
            value={str(step.config, 'body')}
            placeholder="Optional notification body — use {{record.…}} references"
            onChange={(e) => set('body', e.target.value)}
          />
        </div>
      </>
    );
  }

  if (step.type === 'update_field') {
    // Field options come from the trigger's object when known.
    const obj = objects.find((o) => o.slug === triggerObject);
    const fields = obj?.fields.filter((f) => !f.system) ?? [];
    return (
      <div className="wf-grid-2">
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-field`}>
            Field
          </label>
          {fields.length > 0 ? (
            <select
              id={`${step.id}-field`}
              className="st-select"
              value={str(step.config, 'field')}
              onChange={(e) => set('field', e.target.value)}
            >
              <option value="">Select a field…</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${step.id}-field`}
              className="st-input"
              value={str(step.config, 'field')}
              placeholder="field key"
              autoComplete="off"
              onChange={(e) => set('field', e.target.value)}
            />
          )}
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-value`}>
            Value
          </label>
          <VarInput
            id={`${step.id}-value`}
            value={str(step.config, 'value')}
            placeholder="New value"
            groups={groups}
            onChange={(v) => set('value', v)}
          />
        </div>
      </div>
    );
  }

  if (step.type === 'filter' || step.type === 'if_else') {
    // Both share a {field, operator, value} condition row.
    const obj = objects.find((o) => o.slug === triggerObject);
    const fields = obj?.fields.filter((f) => !f.system) ?? [];
    const operator = str(step.config, 'operator') || 'eq';
    const valueless = VALUELESS_OPERATORS.has(operator);
    return (
      <>
        {step.type === 'filter' ? (
          <p className="wf-cfg-hint">
            The workflow continues only when this condition is true.
          </p>
        ) : (
          <p className="wf-cfg-hint">
            Splits the flow into a <strong>True</strong> and an <strong>Else</strong> branch.
          </p>
        )}
        <div className="wf-cond">
          <div className="st-field">
            <label className="st-field__label" htmlFor={`${step.id}-cfield`}>
              Field
            </label>
            {fields.length > 0 ? (
              <select
                id={`${step.id}-cfield`}
                className="st-select"
                value={str(step.config, 'field')}
                onChange={(e) => set('field', e.target.value)}
              >
                <option value="">Select a field…</option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${step.id}-cfield`}
                className="st-input"
                value={str(step.config, 'field')}
                placeholder="field key"
                autoComplete="off"
                onChange={(e) => set('field', e.target.value)}
              />
            )}
          </div>
          <div className="st-field">
            <label className="st-field__label" htmlFor={`${step.id}-coperator`}>
              Operator
            </label>
            <select
              id={`${step.id}-coperator`}
              className="st-select"
              value={operator}
              onChange={(e) => set('operator', e.target.value)}
            >
              {OPERATOR_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <div className="st-field">
            <label className="st-field__label" htmlFor={`${step.id}-cvalue`}>
              Value
            </label>
            <VarInput
              id={`${step.id}-cvalue`}
              value={str(step.config, 'value')}
              placeholder={valueless ? '—' : 'Comparison value'}
              groups={groups}
              onChange={(v) => set('value', v)}
            />
          </div>
        </div>
      </>
    );
  }

  if (step.type === 'find_records') {
    return (
      <>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-fobject`}>
            Object
          </label>
          {objects.length > 0 ? (
            <select
              id={`${step.id}-fobject`}
              className="st-select"
              value={str(step.config, 'object')}
              onChange={(e) => set('object', e.target.value)}
            >
              <option value="">Select an object…</option>
              {objects.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.labelPlural}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${step.id}-fobject`}
              className="st-input"
              value={str(step.config, 'object')}
              placeholder="e.g. opportunities"
              autoComplete="off"
              onChange={(e) => set('object', e.target.value.toLowerCase())}
            />
          )}
        </div>
        <div className="wf-grid-2">
          <div className="st-field">
            <label className="st-field__label" htmlFor={`${step.id}-ffield`}>
              Filter field
            </label>
            <input
              id={`${step.id}-ffield`}
              className="st-input"
              value={str(step.config, 'filterField')}
              placeholder="field key (optional)"
              autoComplete="off"
              onChange={(e) => set('filterField', e.target.value)}
            />
          </div>
          <div className="st-field">
            <label className="st-field__label" htmlFor={`${step.id}-fvalue`}>
              Filter value
            </label>
            <VarInput
              id={`${step.id}-fvalue`}
              value={str(step.config, 'filterValue')}
              placeholder="Match value"
              groups={groups}
              onChange={(v) => set('filterValue', v)}
            />
          </div>
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-flimit`}>
            Limit
          </label>
          <input
            id={`${step.id}-flimit`}
            className="st-input"
            type="number"
            min={1}
            value={str(step.config, 'limit')}
            placeholder="e.g. 50"
            autoComplete="off"
            onChange={(e) => set('limit', e.target.value)}
          />
        </div>
      </>
    );
  }

  // upsert_record
  const obj = objects.find((o) => o.slug === (str(step.config, 'object') || triggerObject));
  const upsertFields = obj?.fields.filter((f) => !f.system) ?? [];
  return (
    <>
      <div className="wf-grid-2">
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-uobject`}>
            Object
          </label>
          {objects.length > 0 ? (
            <select
              id={`${step.id}-uobject`}
              className="st-select"
              value={str(step.config, 'object')}
              onChange={(e) => set('object', e.target.value)}
            >
              <option value="">Select an object…</option>
              {objects.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.labelPlural}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${step.id}-uobject`}
              className="st-input"
              value={str(step.config, 'object')}
              placeholder="e.g. contacts"
              autoComplete="off"
              onChange={(e) => set('object', e.target.value.toLowerCase())}
            />
          )}
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-umatch`}>
            Match field
          </label>
          {upsertFields.length > 0 ? (
            <select
              id={`${step.id}-umatch`}
              className="st-select"
              value={str(step.config, 'matchField')}
              onChange={(e) => set('matchField', e.target.value)}
            >
              <option value="">Select a field…</option>
              {upsertFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${step.id}-umatch`}
              className="st-input"
              value={str(step.config, 'matchField')}
              placeholder="e.g. email"
              autoComplete="off"
              onChange={(e) => set('matchField', e.target.value)}
            />
          )}
        </div>
      </div>
      <div className="wf-grid-2">
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-umatchval`}>
            Match value
          </label>
          <VarInput
            id={`${step.id}-umatchval`}
            value={str(step.config, 'matchValue')}
            placeholder="Value to match on"
            groups={groups}
            onChange={(v) => set('matchValue', v)}
          />
        </div>
        <div className="st-field">
          <label className="st-field__label" htmlFor={`${step.id}-udatafield`}>
            Data field
          </label>
          <input
            id={`${step.id}-udatafield`}
            className="st-input"
            value={str(step.config, 'dataField')}
            placeholder="field key to set"
            autoComplete="off"
            onChange={(e) => set('dataField', e.target.value)}
          />
        </div>
      </div>
      <div className="st-field">
        <label className="st-field__label" htmlFor={`${step.id}-udataval`}>
          Data value
        </label>
        <VarInput
          id={`${step.id}-udataval`}
          value={str(step.config, 'dataValue')}
          placeholder="Value to write"
          groups={groups}
          onChange={(v) => set('dataValue', v)}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: WorkflowStep;
  index: number;
  count: number;
  draft: Workflow;
  objects: ObjectMetadata[];
  triggerObject: string;
  onPatchConfig: (config: Record<string, unknown>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function StepCard({
  step,
  index,
  count,
  draft,
  objects,
  triggerObject,
  onPatchConfig,
  onMove,
  onRemove,
}: StepCardProps): React.JSX.Element {
  const meta = STEP_META[step.type];
  const Icon = meta.icon;
  return (
    <div className="wf-step">
      <div className="wf-step__head">
        <span className="wf-step__index">{index + 1}</span>
        <span className="wf-step__icon">
          <Icon size={14} />
        </span>
        <span className="wf-step__title">{meta.label}</span>
        <span className="wf-step__tools">
          <button
            type="button"
            className="wf-icon-btn"
            aria-label="Move step up"
            title="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            className="wf-icon-btn"
            aria-label="Move step down"
            title="Move down"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={15} />
          </button>
          <button
            type="button"
            className="wf-icon-btn wf-icon-btn--danger"
            aria-label="Remove step"
            title="Remove step"
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>
      <div className="wf-step__body">
        <StepConfig
          step={step}
          index={index}
          draft={draft}
          objects={objects}
          triggerObject={triggerObject}
          onPatch={onPatchConfig}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-step row (type picker)
// ---------------------------------------------------------------------------

function AddStep({ onAdd }: { onAdd: (type: StepType) => void }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <div className="wf-add">
        <button type="button" className="wf-add__btn" onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden="true" />
          Add step
        </button>
      </div>
    );
  }
  return (
    <div className="wf-add">
      <div className="wf-typepicker" role="menu" aria-label="Choose a step type">
        {STEP_ORDER.map((type) => {
          const meta = STEP_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              type="button"
              role="menuitem"
              className="wf-typepicker__opt"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="wf-add__btn" onClick={() => setOpen(false)}>
        <X size={14} aria-hidden="true" />
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder (right pane)
// ---------------------------------------------------------------------------

/** Outcome of the most recent "Run now" click, surfaced inline + transiently. */
type RunNote = { kind: 'ok' | 'err'; message: string };

// ---------------------------------------------------------------------------
// Diagram view (read-only vertical flowchart of trigger + steps)
// ---------------------------------------------------------------------------

function DiagramNode({
  icon: Icon,
  kind,
  title,
  subtitle,
  index,
}: {
  icon: React.ComponentType<{ size?: number }>;
  kind: 'trigger' | 'step';
  title: string;
  subtitle: string;
  index?: number;
}): React.JSX.Element {
  return (
    <div className={`wf-dnode wf-dnode--${kind}`}>
      <span className="wf-dnode__icon">
        <Icon size={15} />
      </span>
      <span className="wf-dnode__text">
        <span className="wf-dnode__title">
          {typeof index === 'number' ? <span className="wf-dnode__num">{index + 1}</span> : null}
          {title}
        </span>
        <span className="wf-dnode__sub">{subtitle}</span>
      </span>
    </div>
  );
}

/** Read-only, pure-CSS vertical flowchart. IF_ELSE shows True/Else branch hints. */
function DiagramView({ draft }: { draft: Workflow }): React.JSX.Element {
  return (
    <div className="wf-diagram" role="img" aria-label="Workflow flow diagram">
      <DiagramNode
        icon={Zap}
        kind="trigger"
        title="Trigger"
        subtitle={triggerSummary(draft.trigger)}
      />
      {draft.steps.length === 0 ? (
        <>
          <span className="wf-dconn" aria-hidden="true" />
          <div className="wf-dempty">No steps — this trigger runs nothing yet.</div>
        </>
      ) : (
        draft.steps.map((step, i) => {
          const meta = STEP_META[step.type];
          const subtitle =
            step.type === 'if_else'
              ? `${str(step.config, 'field') || 'field'} ${
                  OPERATOR_OPTIONS.find((o) => o.value === (str(step.config, 'operator') || 'eq'))
                    ?.label ?? ''
                } ${str(step.config, 'value')}`.trim()
              : meta.blurb;
          return (
            <React.Fragment key={step.id}>
              <span className="wf-dconn" aria-hidden="true" />
              <DiagramNode
                icon={meta.icon}
                kind="step"
                index={i}
                title={meta.label}
                subtitle={subtitle}
              />
              {step.type === 'if_else' ? (
                <div className="wf-dbranch" aria-hidden="true">
                  <span className="wf-dbranch__leg wf-dbranch__leg--true">
                    <span className="wf-dbranch__label">True</span>
                  </span>
                  <span className="wf-dbranch__leg wf-dbranch__leg--else">
                    <span className="wf-dbranch__label">Else</span>
                  </span>
                </div>
              ) : null}
            </React.Fragment>
          );
        })
      )}
      <span className="wf-dconn wf-dconn--end" aria-hidden="true" />
      <div className="wf-dnode wf-dnode--end">
        <span className="wf-dnode__icon">
          <Check size={14} />
        </span>
        <span className="wf-dnode__text">
          <span className="wf-dnode__title">End</span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run history panel
// ---------------------------------------------------------------------------

function RunStatusChip({ status }: { status: RunStatus }): React.JSX.Element {
  const bucket = statusBucket(status);
  const Icon = STATUS_ICON[bucket];
  return (
    <span className={`wf-runstat wf-runstat--${bucket}`} title={STATUS_LABEL[bucket]}>
      <Icon size={12} className={bucket === 'run' ? 'wf-run__spin' : undefined} aria-hidden="true" />
      {STATUS_LABEL[bucket]}
    </span>
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
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="wf-runs">
      <div className="wf-runs__head">
        <span className="wf-runs__title">
          <History size={13} aria-hidden="true" />
          Run history
        </span>
        <button
          type="button"
          className="wf-icon-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh run history"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'wf-run__spin' : undefined} />
        </button>
      </div>
      <div className="wf-runs__body">
        {error ? (
          <div className="wf-runs__empty">{error}</div>
        ) : loading && runs.length === 0 ? (
          <div className="wf-runs__empty">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="wf-runs__empty">No runs yet. Use “Run now” to fire this workflow.</div>
        ) : (
          runs.map((run) => {
            const isOpen = expanded.has(run.id);
            const started = relativeTimeFrom(run.startedAt);
            const finished = relativeTimeFrom(run.finishedAt);
            return (
              <div key={run.id} className="wf-runrow">
                <button
                  type="button"
                  className="wf-runrow__head"
                  aria-expanded={isOpen}
                  onClick={() => toggle(run.id)}
                >
                  <span className={`wf-runrow__caret${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                    <ChevronRight size={14} />
                  </span>
                  <RunStatusChip status={run.status} />
                  <span className="wf-runrow__meta">
                    {started ? `Started ${started}` : 'Started —'}
                    {finished ? ` · Finished ${finished}` : ''}
                  </span>
                  <span className="wf-runrow__count">
                    {run.steps.length} {run.steps.length === 1 ? 'step' : 'steps'}
                  </span>
                </button>
                {isOpen ? (
                  <div className="wf-runrow__steps">
                    {run.steps.length === 0 ? (
                      <div className="wf-runstep wf-runstep--none">No step records.</div>
                    ) : (
                      run.steps.map((s, i) => (
                        <div key={s.id || i} className="wf-runstep">
                          <span className="wf-runstep__num">{i + 1}</span>
                          <span className="wf-runstep__type">
                            {STEP_META[s.type as StepType]?.label ?? s.type}
                          </span>
                          <RunStatusChip status={s.status} />
                          {s.error ? (
                            <span className="wf-runstep__error" title={s.error}>
                              {s.error}
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface BuilderProps {
  draft: Workflow;
  baseline: Workflow;
  objects: ObjectMetadata[];
  saving: boolean;
  deleting: boolean;
  running: boolean;
  runNote: RunNote | null;
  runs: WorkflowRun[];
  runsLoading: boolean;
  runsError: string | null;
  onRefreshRuns: () => void;
  onChange: (next: Workflow) => void;
  onSave: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onRun: () => void;
}

function Builder({
  draft,
  baseline,
  objects,
  saving,
  deleting,
  running,
  runNote,
  runs,
  runsLoading,
  runsError,
  onRefreshRuns,
  onChange,
  onSave,
  onToggleEnabled,
  onDelete,
  onRun,
}: BuilderProps): React.JSX.Element {
  const dirty = !sameWorkflow(draft, baseline);
  /** A draft is "saved" (runnable) when it exists server-side and has no pending edits. */
  const runnable = !dirty && !saving;
  const lastRun = relativeTimeFrom(draft.lastRunAt);
  /** Builder (editable) vs Diagram (read-only flowchart). */
  const [view, setView] = React.useState<'builder' | 'diagram'>('builder');

  const setTrigger = (patch: Partial<WorkflowTrigger>) =>
    onChange({ ...draft, trigger: { ...draft.trigger, ...patch } });

  const addStep = (type: StepType) =>
    onChange({ ...draft, steps: [...draft.steps, emptyStep(type)] });

  const removeStep = (id: string) =>
    onChange({ ...draft, steps: draft.steps.filter((s) => s.id !== id) });

  const patchStepConfig = (id: string, config: Record<string, unknown>) =>
    onChange({
      ...draft,
      steps: draft.steps.map((s) => (s.id === id ? { ...s, config } : s)),
    });

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    const [moved] = steps.splice(index, 1);
    steps.splice(target, 0, moved);
    onChange({ ...draft, steps });
  };

  return (
    <div className="wf-builder">
      <div className="wf-builder__bar">
        <input
          className="st-input wf-builder__title"
          value={draft.name}
          maxLength={120}
          placeholder="Workflow name"
          aria-label="Workflow name"
          autoComplete="off"
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <div className="wf-viewtoggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'builder'}
            className={`wf-viewtoggle__btn${view === 'builder' ? ' is-active' : ''}`}
            onClick={() => setView('builder')}
          >
            <LayoutList size={13} aria-hidden="true" />
            Builder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'diagram'}
            className={`wf-viewtoggle__btn${view === 'diagram' ? ' is-active' : ''}`}
            onClick={() => setView('diagram')}
          >
            <Share2 size={13} aria-hidden="true" />
            Diagram
          </button>
        </div>
        <span className="wf-builder__spacer" />
        <button
          type="button"
          className={`st-switch${draft.enabled ? ' is-on' : ''}`}
          role="switch"
          aria-checked={draft.enabled}
          aria-label={draft.enabled ? 'Disable workflow' : 'Enable workflow'}
          title={draft.enabled ? 'Enabled' : 'Disabled'}
          onClick={onToggleEnabled}
        />
        {dirty ? (
          <span className="wf-dirty">Unsaved changes</span>
        ) : (
          <span className="wf-saved">Saved</span>
        )}
        {lastRun ? (
          <span className="wf-run__last" title="Last run">
            <span className="wf-run__last-icon" aria-hidden="true">
              <History size={12} />
            </span>
            Last run: {lastRun}
          </span>
        ) : null}
        <span className="wf-run">
          <TwentyButton
            variant="secondary"
            icon={running ? undefined : Play}
            disabled={!runnable || running}
            onClick={onRun}
            title={
              runnable
                ? 'Run this workflow now'
                : 'Save your changes before running'
            }
            aria-busy={running}
          >
            {running ? (
              <>
                <Loader2 size={14} className="wf-run__spin" aria-hidden="true" />
                Running…
              </>
            ) : (
              'Run now'
            )}
          </TwentyButton>
          {runNote ? (
            <span
              className={`wf-run__note wf-run__note--${runNote.kind === 'ok' ? 'ok' : 'err'}`}
              role="status"
              aria-live="polite"
              title={runNote.message}
            >
              <span className="wf-run__note-icon" aria-hidden="true">
                {runNote.kind === 'ok' ? (
                  <Check size={12} />
                ) : (
                  <AlertTriangle size={12} />
                )}
              </span>
              {runNote.message}
            </span>
          ) : null}
        </span>
        <TwentyButton
          variant="primary"
          icon={Save}
          disabled={saving || !dirty || !draft.name.trim()}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </TwentyButton>
        <TwentyButton
          variant="ghost"
          icon={Trash2}
          className="st-btn--danger"
          disabled={deleting}
          onClick={onDelete}
          title="Delete workflow"
        >
          Delete
        </TwentyButton>
      </div>

      {view === 'builder' ? (
        <div className="st-field">
          <textarea
            className="st-textarea"
            value={draft.description ?? ''}
            placeholder="Description (optional)"
            aria-label="Workflow description"
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>
      ) : null}

      {view === 'diagram' ? (
        <DiagramView draft={draft} />
      ) : (
      <div className="wf-flow">
        {/* Trigger card */}
        <div className="wf-flow__node">
          <div className="wf-card">
            <div className="wf-card__head">
              <span className="wf-card__head-icon">
                <Zap size={13} />
              </span>
              Trigger
            </div>
            <div className="wf-card__body">
              <span className="wf-trigger-pill">
                <span className="wf-trigger-pill__icon">
                  <Zap size={12} />
                </span>
                When&nbsp;<strong>{triggerSummary(draft.trigger)}</strong>
              </span>
              <div className="wf-grid-2">
                <div className="st-field">
                  <label className="st-field__label" htmlFor="wf-event">
                    Event
                  </label>
                  <select
                    id="wf-event"
                    className="st-select"
                    value={draft.trigger.event}
                    onChange={(e) => setTrigger({ event: e.target.value as TriggerEvent })}
                  >
                    {EVENT_OPTIONS.map((ev) => (
                      <option key={ev.value} value={ev.value}>
                        {ev.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="wf-object">
                    Object
                  </label>
                  {objects.length > 0 ? (
                    <select
                      id="wf-object"
                      className="st-select"
                      value={draft.trigger.object}
                      onChange={(e) => setTrigger({ object: e.target.value })}
                    >
                      <option value="">All objects</option>
                      {objects.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.labelPlural}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="wf-object"
                      className="st-input"
                      value={draft.trigger.object}
                      placeholder="e.g. opportunities"
                      autoComplete="off"
                      onChange={(e) => setTrigger({ object: e.target.value.toLowerCase() })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        {draft.steps.length === 0 ? (
          <>
            <div className="wf-flow__connector" aria-hidden="true" />
            <div className="wf-flow__node">
              <div className="wf-steps-empty">
                No steps yet. Add a step below to run an action when this trigger fires.
              </div>
            </div>
          </>
        ) : (
          draft.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="wf-flow__connector" aria-hidden="true" />
              <div className="wf-flow__node">
                <StepCard
                  step={step}
                  index={index}
                  count={draft.steps.length}
                  draft={draft}
                  objects={objects}
                  triggerObject={draft.trigger.object}
                  onPatchConfig={(config) => patchStepConfig(step.id, config)}
                  onMove={(dir) => moveStep(index, dir)}
                  onRemove={() => removeStep(step.id)}
                />
              </div>
            </React.Fragment>
          ))
        )}

        <div className="wf-flow__connector" aria-hidden="true" />
        <div className="wf-flow__node">
          <AddStep onAdd={addStep} />
        </div>
      </div>
      )}

      <RunHistory
        runs={runs}
        loading={runsLoading}
        error={runsError}
        onRefresh={onRefreshRuns}
      />
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
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete workflow"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete workflow</h2>
          <button type="button" className="st-dialog__close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete <strong style={{ color: 'var(--st-text)' }}>{workflow.name || 'this workflow'}</strong>?
            Its trigger will stop firing and its steps will no longer run. This cannot be undone.
          </p>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </TwentyButton>
          <TwentyButton
            variant="secondary"
            className="st-btn--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete workflow'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (left list)
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="wf-list-skel">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmWorkflowsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [workflows, setWorkflows] = React.useState<Workflow[]>([]);
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  /** Server-known state of the selected workflow (the "baseline" for dirty). */
  const [baseline, setBaseline] = React.useState<Workflow | null>(null);
  /** Locally-edited draft of the selected workflow. */
  const [draft, setDraft] = React.useState<Workflow | null>(null);

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
      setWorkflows(wfRes.data as Workflow[]);
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

  // -- Select a workflow → fetch its full detail (steps/trigger) ----------
  const select = React.useCallback(
    async (workflow: Workflow) => {
      setSelectedId(workflow.id);
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
          const full = res.data as Workflow;
          setBaseline(full);
          // Only overwrite the draft if the user hasn't started editing.
          setDraft((prev) => (prev && prev.id === full.id && sameWorkflow(prev, workflow) ? full : prev));
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
        const created = res.data as Workflow;
        setWorkflows((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setBaseline(created);
        setDraft(created);
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
        const saved = res.data as Workflow;
        setBaseline(saved);
        setDraft(saved);
        setWorkflows((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
      } else {
        setError(res.error);
      }
    } catch {
      setError('Failed to save the workflow. The service may be unavailable.');
    } finally {
      setSaving(false);
    }
  }, [activeProjectId, draft, saving]);

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
          const saved = res.data as Workflow;
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
        }
        setDeleteTarget(null);
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
  }, [deleteTarget, activeProjectId, selectedId]);

  // -- Run now (manual one-off execution of a saved workflow) -------------
  const handleRunNow = React.useCallback(
    async (workflow: Workflow) => {
      if (!activeProjectId || running) return;
      if (runNoteTimer.current) clearTimeout(runNoteTimer.current);
      setRunNote(null);
      setRunning(true);
      const showNote = (note: RunNote) => {
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
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Workflows"
          icon={WorkflowIcon}
          actions={
            activeProjectId ? (
              <TwentyButton
                variant="primary"
                icon={Plus}
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'New workflow'}
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Build event-driven workflows: a trigger fires when a CRM record changes,
          then runs an ordered list of steps. Managing workflows requires the{' '}
          <code>sabcrm:admin</code> capability.
          {workflows.length > 0 ? (
            <>
              {' '}
              {enabledCount} of {workflows.length}{' '}
              {workflows.length === 1 ? 'workflow' : 'workflows'} enabled.
            </>
          ) : null}
        </p>

        {error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoadingProject || loading ? (
          <div className="wf-layout">
            <div className="wf-list">
              <ListSkeleton />
            </div>
            <div className="wf-placeholder">
              <WorkflowIcon className="wf-placeholder__icon" size={22} />
              <span>Loading workflows…</span>
            </div>
          </div>
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">Select a project to manage its workflows.</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <WorkflowIcon size={20} />
            </span>
            <h2 className="st-empty__title">No workflows yet</h2>
            <p className="st-empty__desc">
              Create your first workflow to automatically run steps — create tasks,
              send notifications, update fields, or call webhooks — when CRM events occur.
            </p>
            <TwentyButton
              variant="secondary"
              icon={Plus}
              onClick={() => void handleCreate()}
              disabled={creating}
            >
              New workflow
            </TwentyButton>
          </div>
        ) : (
          <div className="wf-layout">
            {/* Left: list */}
            <div className="wf-list">
              <div className="wf-list__head">
                <span>Workflows</span>
                <span>{workflows.length}</span>
              </div>
              <div className="wf-list__scroll">
                {workflows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`wf-list__item${w.id === selectedId ? ' is-active' : ''}`}
                    onClick={() => void select(w)}
                  >
                    <span className="wf-list__name">
                      <span className="wf-list__name-text">{w.name || 'Untitled workflow'}</span>
                      <span
                        className={`st-switch${w.enabled ? ' is-on' : ''}`}
                        role="switch"
                        aria-checked={w.enabled}
                        aria-label={w.enabled ? 'Disable workflow' : 'Enable workflow'}
                        title={w.enabled ? 'Enabled' : 'Disabled'}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleEnabled(w);
                        }}
                      />
                    </span>
                    <span className="wf-list__trigger">{triggerSummary(w.trigger)}</span>
                    {relativeTimeFrom(w.lastRunAt) ? (
                      <span className="wf-list__lastrun">Last run: {relativeTimeFrom(w.lastRunAt)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: builder */}
            {draft && baseline ? (
              <Builder
                draft={draft}
                baseline={baseline}
                objects={objects}
                saving={saving}
                deleting={deleting && deleteTarget?.id === draft.id}
                running={running}
                runNote={runNote}
                runs={runs}
                runsLoading={runsLoading}
                runsError={runsError}
                onRefreshRuns={() => void loadRuns(draft.id)}
                onChange={setDraft}
                onSave={() => void handleSave()}
                onToggleEnabled={() => void handleToggleEnabled(draft)}
                onDelete={() => setDeleteTarget(draft)}
                onRun={() => void handleRunNow(draft)}
              />
            ) : (
              <div className="wf-placeholder">
                <WorkflowIcon className="wf-placeholder__icon" size={22} />
                <span>Select a workflow to edit, or create a new one.</span>
              </div>
            )}
          </div>
        )}
      </div>

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
