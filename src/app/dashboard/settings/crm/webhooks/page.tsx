'use client';

/**
 * SabCRM - Webhooks settings (`/dashboard/settings/crm/webhooks`).
 *
 * Lists the active project's outbound webhook subscriptions (url, events,
 * status) and supports create / edit / delete / rotate-secret through the
 * admin-gated server actions. Each action independently re-runs the
 * session -> project -> RBAC (`sabcrm:admin`) -> plan pipeline, so the page
 * fails closed even when the layout guard passes.
 *
 * Project scope comes from `useProject()`. States: skeleton while project /
 * data load, "no project" notice, empty list, error banner, and graceful
 * degradation when the backend is unreachable. Built entirely on the 20ui
 * design system.
 */

import * as React from 'react';
import {
  Webhook as WebhookIcon,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  Activity,
  Info,
  Inbox,
  Building2,
  Users,
  Target,
  StickyNote,
  CheckSquare,
} from 'lucide-react';

import {
  Button,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Modal,
  Field,
  Input,
  Checkbox,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listWebhooksAction,
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
  rotateWebhookSecretAction,
} from '@/app/actions/sabcrm.actions';
import type {
  WebhookSubscription,
  CreateWebhookInput,
  UpdateWebhookPatch,
} from '@/app/actions/sabcrm.actions.types';

// ---------------------------------------------------------------------------
// Event catalogue
//
// Declared locally (rather than imported from the server-only webhooks module)
// so this client page never pulls a `server-only` guard into the bundle. Kept
// in sync with `SABCRM_WEBHOOK_EVENTS` in `@/lib/sabcrm/webhooks.server`.
// ---------------------------------------------------------------------------

type WebhookEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted'
  | 'activity.created';

const EVENT_META: ReadonlyArray<{
  value: WebhookEvent;
  label: string;
  desc: string;
}> = [
  {
    value: 'record.created',
    label: 'Record Created',
    desc: 'Fires when any CRM record is created.',
  },
  {
    value: 'record.updated',
    label: 'Record Updated',
    desc: "Fires when a CRM record's data changes.",
  },
  {
    value: 'record.deleted',
    label: 'Record Deleted',
    desc: 'Fires when a CRM record is removed.',
  },
  {
    value: 'activity.created',
    label: 'Activity Created',
    desc: 'Fires when a note, task, call, or comment is logged.',
  },
];

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_META.map((e) => [e.value, e.label]),
);

// ---------------------------------------------------------------------------
// Fine-grained event-type matrix (object x action)
//
// The backend's `events` field is a flat `SabcrmWebhookEvent[]` constrained to
// a *closed* 4-value vocabulary (`record.created|updated|deleted`,
// `activity.created`) - see `@/lib/sabcrm/webhook-events`. SabCRM's record
// events are object-agnostic: one `record.created` fires for every standard
// object. So we present a familiar per-object x action checklist for
// fine-grained selection, then map each selected cell onto the actual
// delivered event the action accepts (deduplicated). This keeps the UI
// granular while emitting exactly what `normaliseEvents` will validate.
// ---------------------------------------------------------------------------

type EventAction = 'created' | 'updated' | 'deleted';

interface StandardObjectMeta {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  /** Whether this object emits the timeline `activity.created` event on create. */
  isActivity: boolean;
}

const STANDARD_OBJECTS: ReadonlyArray<StandardObjectMeta> = [
  { key: 'companies', label: 'Companies', icon: Building2, isActivity: false },
  { key: 'people', label: 'People', icon: Users, isActivity: false },
  {
    key: 'opportunities',
    label: 'Opportunities',
    icon: Target,
    isActivity: false,
  },
  { key: 'notes', label: 'Notes', icon: StickyNote, isActivity: true },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, isActivity: true },
];

const EVENT_ACTIONS: ReadonlyArray<{ key: EventAction; label: string }> = [
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'deleted', label: 'Deleted' },
];

/** A selectable matrix cell id, e.g. `companies.created`. */
type CellId = `${string}.${EventAction}`;

function cellId(objectKey: string, action: EventAction): CellId {
  return `${objectKey}.${action}` as CellId;
}

/**
 * Whether a given object x action cell exists. Notes / Tasks are
 * activity-style objects with no first-class "updated" feed event, so those
 * cells are rendered as not-applicable.
 */
function cellApplies(obj: StandardObjectMeta, action: EventAction): boolean {
  if (obj.isActivity && action === 'updated') return false;
  return true;
}

/** Maps a single matrix cell onto the concrete delivered webhook event. */
function cellToEvent(obj: StandardObjectMeta, action: EventAction): WebhookEvent {
  if (obj.isActivity && action === 'created') return 'activity.created';
  if (action === 'updated') return 'record.updated';
  if (action === 'deleted') return 'record.deleted';
  return 'record.created';
}

/** Every applicable cell id across all objects, in render order. */
const ALL_CELLS: ReadonlyArray<CellId> = STANDARD_OBJECTS.flatMap((obj) =>
  EVENT_ACTIONS.filter((a) => cellApplies(obj, a.key)).map((a) =>
    cellId(obj.key, a.key),
  ),
);

/** Reduces a set of selected cells to the deduped delivered-event list. */
function cellsToEvents(cells: ReadonlySet<CellId>): WebhookEvent[] {
  const out = new Set<WebhookEvent>();
  for (const obj of STANDARD_OBJECTS) {
    for (const a of EVENT_ACTIONS) {
      if (!cellApplies(obj, a.key)) continue;
      if (cells.has(cellId(obj.key, a.key))) {
        out.add(cellToEvent(obj, a.key));
      }
    }
  }
  // Preserve the canonical EVENT_META order in the emitted array.
  return EVENT_META.map((e) => e.value).filter((v) => out.has(v));
}

/**
 * Seeds the cell selection from an existing subscription's flat event list.
 * Because record events are object-agnostic, a stored `record.created` selects
 * the `created` cell for every non-activity object (and `activity.created`
 * selects the activity objects' `created` cells). This round-trips cleanly:
 * `cellsToEvents(seedCellsFromEvents(events))` returns the same event set.
 */
function seedCellsFromEvents(
  events: ReadonlyArray<WebhookEvent>,
): Set<CellId> {
  const has = new Set<WebhookEvent>(events);
  const cells = new Set<CellId>();
  for (const obj of STANDARD_OBJECTS) {
    for (const a of EVENT_ACTIONS) {
      if (!cellApplies(obj, a.key)) continue;
      if (has.has(cellToEvent(obj, a.key))) {
        cells.add(cellId(obj.key, a.key));
      }
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Copyable secret value
// ---------------------------------------------------------------------------

function CopyValue({ value }: { value: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, [value]);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--st-text)]">
        {value}
      </code>
      <Button
        variant="secondary"
        size="sm"
        iconLeft={copied ? Check : Copy}
        onClick={copy}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

interface WebhookFormState {
  url: string;
  description: string;
  /** Fine-grained object x action cell selection. */
  cells: Set<CellId>;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Grouped (object x action) event-type selector
// ---------------------------------------------------------------------------

interface EventMatrixProps {
  cells: Set<CellId>;
  onChange: (next: Set<CellId>) => void;
}

function EventMatrix({ cells, onChange }: EventMatrixProps): React.JSX.Element {
  const allSelected = ALL_CELLS.every((c) => cells.has(c));

  const toggleCell = React.useCallback(
    (id: CellId) => {
      const next = new Set(cells);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    },
    [cells, onChange],
  );

  const toggleObject = React.useCallback(
    (obj: StandardObjectMeta) => {
      const objCells = EVENT_ACTIONS.filter((a) => cellApplies(obj, a.key)).map(
        (a) => cellId(obj.key, a.key),
      );
      const allOn = objCells.every((c) => cells.has(c));
      const next = new Set(cells);
      for (const c of objCells) {
        if (allOn) next.delete(c);
        else next.add(c);
      }
      onChange(next);
    },
    [cells, onChange],
  );

  const toggleAll = React.useCallback(() => {
    onChange(allSelected ? new Set() : new Set(ALL_CELLS));
  }, [allSelected, onChange]);

  const selectedEvents = React.useMemo(() => cellsToEvents(cells), [cells]);

  return (
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-3 py-2.5">
        <Checkbox
          checked={allSelected}
          onChange={toggleAll}
          label="All events"
        />
        <span className="text-xs text-[var(--st-text-secondary)]">
          {cells.size === 0
            ? 'No events selected'
            : `${cells.size} selected, ${selectedEvents.length} delivered event${
                selectedEvents.length === 1 ? '' : 's'
              }`}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
        <span aria-hidden="true" />
        {EVENT_ACTIONS.map((a) => (
          <span
            key={a.key}
            className="text-center text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]"
          >
            {a.label}
          </span>
        ))}

        {STANDARD_OBJECTS.map((obj) => {
          const Icon = obj.icon;
          const objChecked = EVENT_ACTIONS.filter((a) =>
            cellApplies(obj, a.key),
          ).every((a) => cells.has(cellId(obj.key, a.key)));
          return (
            <React.Fragment key={obj.key}>
              <Checkbox
                checked={objChecked}
                onChange={() => toggleObject(obj)}
                title={`Select all ${obj.label} events`}
                label={
                  <span className="inline-flex items-center gap-1.5 text-[var(--st-text)]">
                    <span
                      className="text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    >
                      <Icon size={14} />
                    </span>
                    {obj.label}
                  </span>
                }
              />
              {EVENT_ACTIONS.map((a) => {
                if (!cellApplies(obj, a.key)) {
                  return <span key={a.key} aria-hidden="true" />;
                }
                const id = cellId(obj.key, a.key);
                return (
                  <span key={a.key} className="flex justify-center">
                    <Checkbox
                      aria-label={`${obj.label} ${a.label}`}
                      checked={cells.has(id)}
                      onChange={() => toggleCell(id)}
                    />
                  </span>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      <p className="border-t border-[var(--st-border)] px-3 py-2.5 text-xs leading-relaxed text-[var(--st-text-secondary)]">
        {selectedEvents.length === 0
          ? 'Pick the object events to forward. SabCRM delivers object-agnostic events, so selections map to: '
          : 'Delivered events: '}
        {(selectedEvents.length === 0
          ? EVENT_META.map((e) => e.value)
          : selectedEvents
        ).map((v, i) => (
          <React.Fragment key={v}>
            {i > 0 ? ' ' : ''}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[var(--st-text)]">
              {v}
            </code>
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

interface WebhookDialogProps {
  projectId: string;
  existing: WebhookSubscription | null;
  onClose: () => void;
  onSaved: (sub: WebhookSubscription) => void;
}

function WebhookDialog({
  projectId,
  existing,
  onClose,
  onSaved,
}: WebhookDialogProps): React.JSX.Element {
  const { toast } = useToast();
  const [form, setForm] = React.useState<WebhookFormState>(() => ({
    url: existing?.url ?? '',
    description: existing?.description ?? '',
    cells: existing
      ? seedCellsFromEvents(existing.events as WebhookEvent[])
      : seedCellsFromEvents(['record.created']),
    active: existing?.active ?? true,
  }));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The clear-text secret surfaced once on create.
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const setCells = React.useCallback((next: Set<CellId>) => {
    setForm((f) => ({ ...f, cells: next }));
  }, []);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (!form.url.trim()) {
        setError('A destination URL is required.');
        return;
      }
      const events = cellsToEvents(form.cells);
      if (events.length === 0) {
        setError('Select at least one event.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        if (existing) {
          const patch: UpdateWebhookPatch = {
            url: form.url.trim(),
            description: form.description.trim() || undefined,
            events,
            active: form.active,
          };
          const res = await updateWebhookAction(existing._id, patch, projectId);
          if (res.ok) {
            onSaved(res.data);
            toast.success('Webhook updated.');
            onClose();
          } else {
            setError(res.error);
          }
        } else {
          const input: CreateWebhookInput = {
            url: form.url.trim(),
            description: form.description.trim() || undefined,
            events,
            active: form.active,
          };
          const res = await createWebhookAction(input, projectId);
          if (res.ok) {
            onSaved(res.data);
            if (res.data.secret) {
              setCreatedSecret(res.data.secret);
            } else {
              toast.success('Webhook created.');
              onClose();
            }
          } else {
            setError(res.error);
          }
        }
      } catch {
        setError('Failed to save the webhook. The service may be unavailable.');
      } finally {
        setSubmitting(false);
      }
    },
    [form, existing, submitting, projectId, onSaved, onClose, toast],
  );

  if (createdSecret) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Webhook created"
        size="md"
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[var(--st-text)]">
            Signing secret
          </span>
          <CopyValue value={createdSecret} />
          <span className="text-xs text-[var(--st-text-secondary)]">
            Use this secret to verify the signature on incoming deliveries. It
            is shown only once, so copy it now.
          </span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Edit webhook' : 'New webhook'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="webhook-form"
            variant="primary"
            loading={submitting}
          >
            {existing ? 'Save changes' : 'Create webhook'}
          </Button>
        </>
      }
    >
      <form id="webhook-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Destination URL" required>
          <Input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://example.com/webhooks/sabcrm"
            autoFocus
          />
        </Field>

        <Field label="Description">
          <Input
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Optional label"
            maxLength={120}
          />
        </Field>

        <Field label="Events" required>
          <EventMatrix cells={form.cells} onChange={setCells} />
        </Field>

        <Checkbox
          checked={form.active}
          onChange={(e) =>
            setForm((f) => ({ ...f, active: e.target.checked }))
          }
          label="Active - deliver events to this endpoint"
        />

        {error ? (
          <Alert tone="danger" icon={AlertTriangle}>
            {error}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  sub: WebhookSubscription;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({
  sub,
  busy,
  onCancel,
  onConfirm,
}: DeleteDialogProps): React.JSX.Element {
  return (
    <Modal
      open
      onClose={onCancel}
      title="Delete webhook"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            Delete webhook
          </Button>
        </>
      }
    >
      <p className="m-0 text-[var(--st-text-secondary)]">
        Delete the subscription to{' '}
        <strong className="text-[var(--st-text)]">{sub.url}</strong>? Events
        will no longer be delivered. This cannot be undone.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Rotate-secret result dialog
// ---------------------------------------------------------------------------

function RotatedSecretDialog({
  secret,
  onClose,
}: {
  secret: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal
      open
      onClose={onClose}
      title="New signing secret"
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--st-text)]">
          Signing secret
        </span>
        <CopyValue value={secret} />
        <span className="text-xs text-[var(--st-text-secondary)]">
          The previous secret is now invalid. Update your endpoint with this
          value, it is shown only once.
        </span>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Recent deliveries dialog
//
// The backend does not (yet) expose a per-delivery log array - there is no
// `deliveries` / `recentDeliveries` / `logs` field on `WebhookSubscription`,
// and no "send test" / "ping" server action in `sabcrm.actions`. What it *does*
// carry is a single last-delivery summary (`lastDeliveryAt`, `lastStatus`,
// `lastError`, `failureCount`). We render that summary as one delivery entry
// when present, and otherwise show a tidy "No deliveries yet" empty state.
//
// Because no test-delivery action exists, this view stays honestly read-only.
// ---------------------------------------------------------------------------

/** Formats an ISO timestamp into a short, locale-aware label; falls back to the raw value. */
function formatDeliveryTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(t).toISOString();
  }
}

/** True when an HTTP status code denotes success (2xx). */
function isSuccessStatus(status: number | null | undefined): boolean {
  return typeof status === 'number' && status >= 200 && status < 300;
}

function DeliveriesDialog({
  sub,
  onClose,
}: {
  sub: WebhookSubscription;
  onClose: () => void;
}): React.JSX.Element {
  // Derive a single delivery entry from the last-delivery summary, if any.
  const hasDelivery = Boolean(sub.lastDeliveryAt);
  const success = isSuccessStatus(sub.lastStatus);

  return (
    <Modal
      open
      onClose={onClose}
      title="Recent deliveries"
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm text-[var(--st-text)]">
            {sub.url}
          </span>
          {sub.description ? (
            <span className="text-xs text-[var(--st-text-secondary)]">
              {sub.description}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--st-text)]">
            Deliveries
          </span>
          {hasDelivery ? (
            <span className="text-xs text-[var(--st-text-tertiary)]">
              last attempt
            </span>
          ) : null}
        </div>

        {hasDelivery ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li className="flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <Badge tone={success ? 'success' : 'danger'} dot>
                {success ? 'Success' : 'Failed'}
              </Badge>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm text-[var(--st-text)]">
                  {sub.events.map((e) => EVENT_LABEL[e] ?? e).join(', ')}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                  {typeof sub.lastStatus === 'number' ? (
                    <code className="font-mono">HTTP {sub.lastStatus}</code>
                  ) : (
                    <code className="font-mono">no response</code>
                  )}
                  <span aria-hidden="true">-</span>
                  <span>
                    {formatDeliveryTime(sub.lastDeliveryAt as string)}
                  </span>
                  {sub.failureCount > 0 ? (
                    <>
                      <span aria-hidden="true">-</span>
                      <span>
                        {sub.failureCount} consecutive failure
                        {sub.failureCount === 1 ? '' : 's'}
                      </span>
                    </>
                  ) : null}
                </span>
                {!success && sub.lastError ? (
                  <span className="text-xs text-[var(--st-danger)]">
                    {sub.lastError}
                  </span>
                ) : null}
              </div>
            </li>
          </ul>
        ) : (
          <EmptyState
            icon={Inbox}
            size="sm"
            title="No deliveries yet"
            description="Once an event matching this subscription fires, the most recent delivery attempt and its response will appear here."
          />
        )}

        <div
          className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs text-[var(--st-text-secondary)]"
          role="note"
        >
          <Info
            className="mt-0.5 shrink-0 text-[var(--st-text-tertiary)]"
            size={14}
            aria-hidden="true"
          />
          <span>
            SabCRM records the most recent delivery attempt per subscription.{' '}
            <span className="block text-[var(--st-text-tertiary)]">
              Sending a manual test delivery is not available yet. This view
              updates automatically the next time a subscribed event fires.
            </span>
          </span>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function WebhooksSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height={44} radius={8} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmWebhooksSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [hooks, setHooks] = React.useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WebhookSubscription | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WebhookSubscription | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [rotatingId, setRotatingId] = React.useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = React.useState<string | null>(null);
  const [deliveriesTarget, setDeliveriesTarget] =
    React.useState<WebhookSubscription | null>(null);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWebhooksAction(projectId);
      if (res.ok) {
        setHooks(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Webhooks could not be loaded. The service may be unavailable.');
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

  const upsertHook = React.useCallback((sub: WebhookSubscription) => {
    setHooks((prev) => {
      const idx = prev.findIndex((h) => h._id === sub._id);
      if (idx === -1) return [sub, ...prev];
      const next = [...prev];
      next[idx] = sub;
      return next;
    });
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    try {
      const res = await deleteWebhookAction(deleteTarget._id, activeProjectId);
      if (res.ok) {
        setHooks((prev) => prev.filter((h) => h._id !== deleteTarget._id));
        setDeleteTarget(null);
        toast.success('Webhook deleted.');
      } else {
        setError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setError('Failed to delete the webhook. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId, toast]);

  const rotate = React.useCallback(
    async (sub: WebhookSubscription) => {
      if (!activeProjectId) return;
      setRotatingId(sub._id);
      setError(null);
      try {
        const res = await rotateWebhookSecretAction(sub._id, activeProjectId);
        if (res.ok) {
          upsertHook(res.data);
          if (res.data.secret) setRotatedSecret(res.data.secret);
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to rotate the secret. The service may be unavailable.');
      } finally {
        setRotatingId(null);
      }
    },
    [activeProjectId, upsertHook],
  );

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((sub: WebhookSubscription) => {
    setEditing(sub);
    setDialogOpen(true);
  }, []);

  return (
    <div className="ui20">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Webhooks</PageTitle>
            <PageDescription>
              Send a POST request to a destination URL whenever a record is
              created, updated, or deleted. Managing webhooks requires the{' '}
              <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[var(--st-text)]">
                sabcrm:admin
              </code>{' '}
              capability.
            </PageDescription>
          </PageHeaderHeading>
          {activeProjectId ? (
            <PageActions>
              <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                New webhook
              </Button>
            </PageActions>
          ) : null}
        </PageHeader>

        {error ? (
          <Alert
            tone="danger"
            icon={AlertTriangle}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        ) : null}

        {isLoadingProject || loading ? (
          <WebhooksSkeleton />
        ) : !activeProjectId ? (
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to manage its webhook subscriptions."
          />
        ) : hooks.length === 0 ? (
          <EmptyState
            icon={WebhookIcon}
            title="No webhooks yet"
            description="Create a subscription to forward CRM events to an external endpoint."
            action={
              <Button variant="secondary" iconLeft={Plus} onClick={openCreate}>
                New webhook
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th>Endpoint</Th>
                  <Th>Events</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {hooks.map((sub) => (
                  <Tr key={sub._id}>
                    <Td>
                      <span className="font-mono text-[var(--st-text)]">
                        {sub.url}
                      </span>
                      {sub.description ? (
                        <div className="text-xs text-[var(--st-text-secondary)]">
                          {sub.description}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {sub.events.map((e) => (
                          <Badge key={e} tone="neutral">
                            {EVENT_LABEL[e] ?? e}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={sub.active ? 'success' : 'neutral'} dot>
                        {sub.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Activity}
                          onClick={() => setDeliveriesTarget(sub)}
                          title="View recent deliveries"
                        >
                          Deliveries
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={RefreshCw}
                          onClick={() => rotate(sub)}
                          loading={rotatingId === sub._id}
                          title="Rotate signing secret"
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Pencil}
                          onClick={() => openEdit(sub)}
                          title="Edit webhook"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          iconLeft={Trash2}
                          onClick={() => setDeleteTarget(sub)}
                          title="Delete webhook"
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {dialogOpen && activeProjectId ? (
        <WebhookDialog
          projectId={activeProjectId}
          existing={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={upsertHook}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          sub={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}

      {rotatedSecret ? (
        <RotatedSecretDialog
          secret={rotatedSecret}
          onClose={() => setRotatedSecret(null)}
        />
      ) : null}

      {deliveriesTarget ? (
        <DeliveriesDialog
          sub={deliveriesTarget}
          onClose={() => setDeliveriesTarget(null)}
        />
      ) : null}
    </div>
  );
}
