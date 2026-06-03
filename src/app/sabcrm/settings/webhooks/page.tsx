'use client';

/**
 * SabCRM — Webhooks settings (`/sabcrm/settings/webhooks`), Twenty-style.
 *
 * Mirrors Twenty CRM's "Settings → Developers → Webhooks" surface on the
 * SabNode stack. Lists the active project's outbound webhook subscriptions
 * (url, events, status) and supports create / edit / delete / rotate-secret
 * through the admin-gated server actions. Each action independently re-runs the
 * session → project → RBAC (`sabcrm:admin`) → plan pipeline, so the page fails
 * closed even when the layout guard passes.
 *
 * Project scope comes from `useProject()`. States: skeleton while project /
 * data load, "no project" notice, empty list, error banner, and graceful
 * degradation when the backend is unreachable.
 */

import * as React from 'react';
import {
  Webhook as WebhookIcon,
  Plus,
  X,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  Activity,
  Send,
  Info,
  Inbox,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
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

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './webhooks-log.css';

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
    <div className="st-secret__value">
      <code className="st-secret__code">{value}</code>
      <TwentyButton variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </TwentyButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

interface WebhookFormState {
  url: string;
  description: string;
  events: WebhookEvent[];
  active: boolean;
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
  const [form, setForm] = React.useState<WebhookFormState>(() => ({
    url: existing?.url ?? '',
    description: existing?.description ?? '',
    events: (existing?.events as WebhookEvent[] | undefined) ?? ['record.created'],
    active: existing?.active ?? true,
  }));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The clear-text secret surfaced once on create.
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const toggleEvent = React.useCallback((value: WebhookEvent) => {
    setForm((f) => {
      const has = f.events.includes(value);
      return {
        ...f,
        events: has
          ? f.events.filter((e) => e !== value)
          : [...f.events, value],
      };
    });
  }, []);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (!form.url.trim()) {
        setError('A destination URL is required.');
        return;
      }
      if (form.events.length === 0) {
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
            events: form.events,
            active: form.active,
          };
          const res = await updateWebhookAction(existing._id, patch, projectId);
          if (res.ok) {
            onSaved(res.data);
            onClose();
          } else {
            setError(res.error);
          }
        } else {
          const input: CreateWebhookInput = {
            url: form.url.trim(),
            description: form.description.trim() || undefined,
            events: form.events,
            active: form.active,
          };
          const res = await createWebhookAction(input, projectId);
          if (res.ok) {
            onSaved(res.data);
            if (res.data.secret) {
              setCreatedSecret(res.data.secret);
            } else {
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
    [form, existing, submitting, projectId, onSaved, onClose],
  );

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={existing ? 'Edit webhook' : 'Create webhook'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !createdSecret) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 520 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">
            {createdSecret
              ? 'Webhook created'
              : existing
                ? 'Edit webhook'
                : 'New webhook'}
          </h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {createdSecret ? (
          <>
            <div className="st-dialog__body">
              <div className="st-secret">
                <span className="st-secret__label">Signing secret</span>
                <CopyValue value={createdSecret} />
                <span className="st-secret__hint">
                  Use this secret to verify the signature on incoming
                  deliveries. It is shown only once — copy it now.
                </span>
              </div>
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="primary" onClick={onClose}>
                Done
              </TwentyButton>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="st-dialog__body">
              <div className="st-field">
                <label className="st-field__label" htmlFor="wh-url">
                  Destination URL
                  <span className="st-field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="wh-url"
                  className="st-input"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com/webhooks/sabcrm"
                  autoFocus
                />
              </div>

              <div className="st-field">
                <label className="st-field__label" htmlFor="wh-desc">
                  Description
                </label>
                <input
                  id="wh-desc"
                  className="st-input"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Optional label"
                  maxLength={120}
                />
              </div>

              <div className="st-field">
                <span className="st-field__label">
                  Events
                  <span className="st-field__req" aria-hidden="true">
                    *
                  </span>
                </span>
                <div className="st-checklist">
                  {EVENT_META.map((evt) => (
                    <label key={evt.value} className="st-checklist__item">
                      <input
                        type="checkbox"
                        checked={form.events.includes(evt.value)}
                        onChange={() => toggleEvent(evt.value)}
                      />
                      <span>
                        <span className="st-checklist__title">{evt.label}</span>
                        <br />
                        <span className="st-checklist__desc">{evt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="st-checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Active — deliver events to this endpoint
              </label>

              {error ? <p className="st-form-error">{error}</p> : null}
            </div>
            <div className="st-dialog__footer">
              <TwentyButton variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </TwentyButton>
              <TwentyButton type="submit" variant="primary" disabled={submitting}>
                {submitting
                  ? 'Saving…'
                  : existing
                    ? 'Save changes'
                    : 'Create webhook'}
              </TwentyButton>
            </div>
          </form>
        )}
      </div>
    </div>
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
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete webhook"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete webhook</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete the subscription to{' '}
            <strong style={{ color: 'var(--st-text)' }}>{sub.url}</strong>? Events
            will no longer be delivered. This cannot be undone.
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
            {busy ? 'Deleting…' : 'Delete webhook'}
          </TwentyButton>
        </div>
      </div>
    </div>
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
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="New signing secret"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">New signing secret</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <div className="st-secret">
            <span className="st-secret__label">Signing secret</span>
            <CopyValue value={secret} />
            <span className="st-secret__hint">
              The previous secret is now invalid. Update your endpoint with this
              value — it is shown only once.
            </span>
          </div>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="primary" onClick={onClose}>
            Done
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent deliveries dialog
//
// The backend does not (yet) expose a per-delivery log array — there is no
// `deliveries` / `recentDeliveries` / `logs` field on `WebhookSubscription` and
// no "send test" server action. What it *does* carry is a single last-delivery
// summary (`lastDeliveryAt`, `lastStatus`, `lastError`, `failureCount`). We
// render that summary as one delivery entry when present, and otherwise show a
// tidy "No deliveries yet" empty state. The "Send test" button is therefore an
// explicit, non-persisted client stub (no action is invented).
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
  // Local, non-persisted "Send test" stub state.
  const [testNote, setTestNote] = React.useState<string | null>(null);

  const sendTest = React.useCallback(() => {
    // No server action exists for issuing a test delivery — keep this honest:
    // surface a clearly-labelled stub note rather than pretending it persisted.
    setTestNote(new Date().toLocaleTimeString());
  }, []);

  // Derive a single delivery entry from the last-delivery summary, if any.
  const hasDelivery = Boolean(sub.lastDeliveryAt);
  const success = isSuccessStatus(sub.lastStatus);

  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Recent deliveries"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 540 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Recent deliveries</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="st-dialog__body">
          <div className="st-whlog__target">
            <span className="st-whlog__target-url">{sub.url}</span>
            {sub.description ? (
              <span className="st-whlog__target-desc">{sub.description}</span>
            ) : null}
          </div>

          <div className="st-whlog__heading">
            <span>Deliveries</span>
            {hasDelivery ? (
              <span className="st-whlog__count">last attempt</span>
            ) : null}
          </div>

          {hasDelivery ? (
            <ul className="st-whlog__list">
              <li className="st-whlog__item">
                <span
                  className={`st-chip ${success ? 'st-chip--ok' : 'st-chip--err'}`}
                  title={success ? 'Succeeded' : 'Failed'}
                >
                  <span className="st-chip__dot" aria-hidden="true" />
                  <span className="st-chip__label">
                    {success ? 'Success' : 'Failed'}
                  </span>
                </span>
                <div className="st-whlog__item-main">
                  <span className="st-whlog__item-event">
                    {sub.events.map((e) => EVENT_LABEL[e] ?? e).join(', ')}
                  </span>
                  <span className="st-whlog__item-meta">
                    {typeof sub.lastStatus === 'number' ? (
                      <code>HTTP {sub.lastStatus}</code>
                    ) : (
                      <code>no response</code>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{formatDeliveryTime(sub.lastDeliveryAt as string)}</span>
                    {sub.failureCount > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {sub.failureCount} consecutive failure
                          {sub.failureCount === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {!success && sub.lastError ? (
                    <span className="st-whlog__item-error">{sub.lastError}</span>
                  ) : null}
                </div>
              </li>
            </ul>
          ) : (
            <div className="st-whlog__empty">
              <span className="st-whlog__empty-icon">
                <Inbox size={18} />
              </span>
              <span className="st-whlog__empty-title">No deliveries yet</span>
              <span className="st-whlog__empty-desc">
                Once an event matching this subscription fires, the most recent
                delivery attempt and its response will appear here.
              </span>
            </div>
          )}

          {testNote ? (
            <div className="st-whlog__note" role="status">
              <Info className="st-whlog__note-icon" size={14} aria-hidden="true" />
              <span>
                <strong>Test event queued</strong> at {testNote}.
                <span className="st-whlog__note-stub">
                  Stub only — this is a local preview and was not sent to the
                  endpoint. A real test-delivery action is not yet available.
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <div className="st-dialog__footer st-whlog__footer">
          <TwentyButton variant="secondary" icon={Send} onClick={sendTest}>
            Send test
          </TwentyButton>
          <TwentyButton variant="primary" onClick={onClose}>
            Done
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function WebhooksSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmWebhooksSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

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
  }, [deleteTarget, activeProjectId]);

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
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Webhooks"
          icon={WebhookIcon}
          actions={
            activeProjectId ? (
              <TwentyButton variant="primary" icon={Plus} onClick={openCreate}>
                New webhook
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Send a POST request to a destination URL whenever a record is created,
          updated, or deleted. Managing webhooks requires the{' '}
          <code>sabcrm:admin</code> capability.
        </p>

        {error ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {isLoadingProject || loading ? (
          <WebhooksSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to manage its webhook subscriptions.
            </p>
          </div>
        ) : hooks.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <WebhookIcon size={20} />
            </span>
            <h2 className="st-empty__title">No webhooks yet</h2>
            <p className="st-empty__desc">
              Create a subscription to forward CRM events to an external
              endpoint.
            </p>
            <TwentyButton variant="secondary" icon={Plus} onClick={openCreate}>
              New webhook
            </TwentyButton>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Events</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {hooks.map((sub) => (
                  <tr key={sub._id} className="st-row">
                    <td>
                      <span className="st-mono">{sub.url}</span>
                      {sub.description ? (
                        <div className="st-identity__sub">{sub.description}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="st-chip-row">
                        {sub.events.map((e) => (
                          <span key={e} className="st-chip">
                            <span className="st-chip__label">
                              {EVENT_LABEL[e] ?? e}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`st-chip ${sub.active ? 'st-chip--ok' : 'st-chip--off'}`}
                      >
                        <span className="st-chip__dot" aria-hidden="true" />
                        <span className="st-chip__label">
                          {sub.active ? 'Active' : 'Disabled'}
                        </span>
                      </span>
                    </td>
                    <td className="st-cell-actions">
                      <TwentyButton
                        variant="ghost"
                        icon={Activity}
                        onClick={() => setDeliveriesTarget(sub)}
                        title="View recent deliveries"
                      >
                        Deliveries
                      </TwentyButton>
                      <TwentyButton
                        variant="ghost"
                        icon={RefreshCw}
                        onClick={() => rotate(sub)}
                        disabled={rotatingId === sub._id}
                        title="Rotate signing secret"
                      >
                        {rotatingId === sub._id ? 'Rotating…' : 'Rotate'}
                      </TwentyButton>
                      <TwentyButton
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => openEdit(sub)}
                        title="Edit webhook"
                      >
                        Edit
                      </TwentyButton>
                      <TwentyButton
                        variant="ghost"
                        icon={Trash2}
                        className="st-btn--danger"
                        onClick={() => setDeleteTarget(sub)}
                        title="Delete webhook"
                      >
                        Delete
                      </TwentyButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
