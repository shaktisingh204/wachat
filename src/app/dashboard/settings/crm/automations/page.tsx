'use client';

/**
 * SabCRM Settings - Workflows (`/dashboard/settings/crm/automations`).
 *
 * A WORKFLOW builder: a vertical "flow" of a single trigger followed by ordered
 * steps. The left pane lists every workflow (name, enabled toggle, trigger
 * summary); the right pane is the builder for the selected one:
 *
 *   - Trigger card  -> event select + object select.
 *   - Steps flow    -> connector-linked cards, each with a small per-type config
 *                      form (create_task / send_notification / update_field /
 *                      webhook / filter / if_else / find_records / upsert_record).
 *                      Add (type picker), remove, and reorder (up/down).
 *
 * Advanced authoring layered on top:
 *   - Variable picker  -> text inputs carry a `{{}}` button that inserts
 *                         `{{trigger...}}` / `{{record...}}` / `{{steps.<id>...}}`
 *                         tokens chosen from a grouped dropdown.
 *   - Diagram view     -> a "Builder" / "Diagram" toggle renders the trigger +
 *                         steps as a read-only vertical flowchart with True/Else
 *                         branch hints for if_else.
 *   - Run history      -> `listWorkflowRunsTw(id)` lists past runs with a status
 *                         badge, relative started/finished times, and expandable
 *                         per-step status; refreshed after every Run-now.
 *
 * Wired to the workflows engine through the gated server actions in
 * `@/app/actions/sabcrm-workflows.actions` (list / get / create / update /
 * delete), `runWorkflowNowTw` (manual run) and `listWorkflowRunsTw` (history).
 * Object + field pickers read `listObjectsTw` from
 * `@/app/actions/sabcrm-objects.actions`. The engine may be DOWN at dev time -
 * every call is normalised to `{ ok, ... }` and the UI degrades to graceful
 * loading / empty / error states and never crashes.
 *
 * Pure 20ui: PageHeader, Card, Button, IconButton, Switch, SegmentedControl,
 * Alert, Badge, EmptyState, Skeleton, AlertDialog. The shared trigger -> action
 * editor (`AutomationBuilder`) is the only non-primitive composed here. Auth /
 * project / RBAC guards are enforced upstream by the layout and re-checked
 * inside each server action.
 */

import * as React from 'react';
import {
  Zap,
  Plus,
  AlertTriangle,
  ClipboardList,
  Bell,
  Webhook,
  PenLine,
  Workflow as WorkflowIcon,
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/sabcrm/20ui';
import { AutomationBuilder } from '@/components/sabcrm/twenty';
import type {
  AutomationDraft,
  AutomationStep,
} from '@/components/sabcrm/twenty';
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

const STATUS_ICON: Record<'ok' | 'fail' | 'run' | 'wait', React.ComponentType<{ size?: number; className?: string }>> = {
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
  kind: 'trigger' | 'step' | 'end';
  title: string;
  subtitle?: string;
  index?: number;
}): React.JSX.Element {
  const accent =
    kind === 'trigger'
      ? 'border-[var(--st-accent)] text-[var(--st-accent)]'
      : kind === 'end'
        ? 'border-[var(--st-status-ok)] text-[var(--st-status-ok)]'
        : 'border-[var(--st-border)] text-[var(--st-text-secondary)]';
  return (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-[var(--st-bg)] ${accent}`}
        aria-hidden="true"
      >
        <Icon size={15} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-text)]">
          {typeof index === 'number' ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--st-border)] px-1 text-[10px] font-semibold text-[var(--st-text-secondary)]">
              {index + 1}
            </span>
          ) : null}
          {title}
        </span>
        {subtitle ? (
          <span className="truncate text-xs text-[var(--st-text-secondary)]">{subtitle}</span>
        ) : null}
      </span>
    </div>
  );
}

/** A vertical connector between diagram nodes. */
function DiagramConnector(): React.JSX.Element {
  return <span className="h-5 w-px bg-[var(--st-border)]" aria-hidden="true" />;
}

/** Read-only vertical flowchart. IF_ELSE shows True/Else branch hints. */
function DiagramView({ draft }: { draft: Workflow }): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-0 py-2"
      role="img"
      aria-label="Workflow flow diagram"
    >
      <DiagramNode
        icon={Zap}
        kind="trigger"
        title="Trigger"
        subtitle={triggerSummary(draft.trigger)}
      />
      {draft.steps.length === 0 ? (
        <>
          <DiagramConnector />
          <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] px-4 py-3 text-sm text-[var(--st-text-tertiary)]">
            No steps. This trigger runs nothing yet.
          </div>
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
              <DiagramConnector />
              <DiagramNode
                icon={meta.icon}
                kind="step"
                index={i}
                title={meta.label}
                subtitle={subtitle}
              />
              {step.type === 'if_else' ? (
                <div
                  className="flex w-full max-w-sm items-center justify-around pt-1"
                  aria-hidden="true"
                >
                  <span className="rounded-full bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-status-ok)]">
                    True
                  </span>
                  <span className="rounded-full bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[11px] font-medium text-[var(--st-text-tertiary)]">
                    Else
                  </span>
                </div>
              ) : null}
            </React.Fragment>
          );
        })
      )}
      <DiagramConnector />
      <DiagramNode icon={Check} kind="end" title="End" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run history panel
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
  const toggle = (id: string) =>
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
            No runs yet. Use "Run now" to fire this workflow.
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
                      {finished ? ` . Finished ${finished}` : ''}
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
                                {STEP_META[s.type as StepType]?.label ?? s.type}
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

const VIEW_OPTIONS: ReadonlyArray<SegmentedItem<'builder' | 'diagram'>> = [
  { value: 'builder', label: 'Builder', icon: LayoutList },
  { value: 'diagram', label: 'Diagram', icon: Share2 },
];

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
    <div className="flex flex-col gap-4">
      {/* Run controls + view toggle (page-level extras around the shared editor). */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          items={VIEW_OPTIONS}
          value={view}
          onChange={setView}
          size="sm"
          aria-label="View mode"
        />
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
      </div>

      {runNote ? (
        <Alert tone={runNote.kind === 'ok' ? 'success' : 'danger'}>{runNote.message}</Alert>
      ) : null}

      {view === 'diagram' ? (
        <Card padding="lg">
          <DiagramView draft={draft} />
        </Card>
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

  // -- Select a workflow -> fetch its full detail (steps/trigger) ----------
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
        toast.success('Workflow saved');
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
        toast.success('Workflow deleted');
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
    <div className="ui20 mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <WorkflowIcon size={20} aria-hidden="true" />
            Workflows
          </PageTitle>
          <PageDescription>
            Build event-driven workflows: a trigger fires when a CRM record changes,
            then runs an ordered list of steps. Managing workflows requires the{' '}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
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
          description="Create your first workflow to automatically run steps - create tasks, send notifications, update fields, or call webhooks - when CRM events occur."
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          {/* Left: list */}
          <Card padding="none" className="overflow-hidden self-start">
            <CardHeader className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-2.5">
              <CardTitle className="text-sm">Workflows</CardTitle>
              <Badge tone="neutral" kind="soft">
                {workflows.length}
              </Badge>
            </CardHeader>
            <CardBody className="max-h-[60vh] overflow-y-auto p-2">
              <ul className="flex flex-col gap-1">
                {workflows.map((w) => {
                  const active = w.id === selectedId;
                  const last = relativeTimeFrom(w.lastRunAt);
                  return (
                    <li key={w.id} className="relative">
                      <Button
                        variant="ghost"
                        block
                        onClick={() => void select(w)}
                        className={`!justify-start rounded-[var(--st-radius)] border px-3 py-2.5 pr-12 text-left [&>.u-btn__label]:flex [&>.u-btn__label]:w-full [&>.u-btn__label]:flex-col [&>.u-btn__label]:items-start [&>.u-btn__label]:gap-1 ${
                          active
                            ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                            : 'border-transparent hover:bg-[var(--st-bg-secondary)]'
                        }`}
                      >
                        <span className="w-full truncate text-sm font-medium text-[var(--st-text)]">
                          {w.name || 'Untitled workflow'}
                        </span>
                        <span className="w-full truncate text-xs text-[var(--st-text-secondary)]">
                          {triggerSummary(w.trigger)}
                        </span>
                        {last ? (
                          <span className="text-xs text-[var(--st-text-tertiary)]">
                            Last run: {last}
                          </span>
                        ) : null}
                      </Button>
                      <span className="absolute right-3 top-3">
                        <Switch
                          checked={w.enabled}
                          size="sm"
                          aria-label={w.enabled ? 'Disable workflow' : 'Enable workflow'}
                          title={w.enabled ? 'Enabled' : 'Disabled'}
                          onCheckedChange={() => void handleToggleEnabled(w)}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

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
            <EmptyState
              icon={WorkflowIcon}
              title="No workflow selected"
              description="Select a workflow to edit, or create a new one."
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
