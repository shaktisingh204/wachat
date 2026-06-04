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
  X,
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

import { TwentyPageHeader, TwentyButton, AutomationBuilder } from '@/components/sabcrm/twenty';
import type {
  AutomationDraft,
  AutomationStep,
} from '@/components/sabcrm/twenty';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v : '';
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

  /**
   * Bridge the page's richer `Workflow` draft to the shared `AutomationBuilder`'s
   * `AutomationDraft`. Every edit the shared builder emits is merged back onto the
   * full `Workflow` (preserving `id`, `lastRunAt`, and any engine-only fields the
   * page tracks). The shared builder's step-type union is a subset of the page's,
   * so step changes round-trip through a structural cast.
   */
  const handleBuilderChange = (next: AutomationDraft) =>
    onChange({
      ...draft,
      name: next.name,
      description: next.description,
      enabled: next.enabled,
      trigger: next.trigger,
      steps: next.steps as unknown as WorkflowStep[],
    });

  return (
    <div className="wf-builder">
      {/* Run controls + view toggle (page-level extras around the shared editor). */}
      <div className="wf-builder__bar">
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
      </div>

      {view === 'diagram' ? (
        <DiagramView draft={draft} />
      ) : (
        <AutomationBuilder
          value={{
            id: draft.id,
            name: draft.name,
            description: draft.description,
            enabled: draft.enabled,
            trigger: draft.trigger,
            steps: draft.steps as unknown as AutomationStep[],
          }}
          objects={objects}
          busy={saving || deleting}
          dirty={dirty}
          onChange={handleBuilderChange}
          onSave={onSave}
          onToggleEnabled={onToggleEnabled}
          onDelete={onDelete}
        />
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
                        tabIndex={0}
                        aria-checked={w.enabled}
                        aria-label={w.enabled ? 'Disable workflow' : 'Enable workflow'}
                        title={w.enabled ? 'Enabled' : 'Disabled'}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleEnabled(w);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleToggleEnabled(w);
                          }
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
