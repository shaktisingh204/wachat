'use client';

/**
 * SabCRM Settings — Automations (`/sabcrm/settings/automations`), Twenty-style.
 *
 * Lists the active project's event-driven automation rules in a Twenty table:
 * name, trigger → action summary, a status chip (derived from
 * listAutomationRuleStatusesAction), and an enable/disable toggle. Supports
 * create / edit via a Twenty dialog (mirroring the rule capabilities: identity,
 * trigger event + object scope, and one of three action types) and delete via a
 * confirmation dialog.
 *
 * All mutations go through the gated server actions in
 * `src/app/actions/sabcrm.actions.ts`; the gate re-runs
 * session → project → RBAC (`sabcrm:admin`) → plan → Mongo so direct API access
 * fails closed. Auth / project guards are enforced upstream by `../../layout.tsx`.
 *
 * Twenty visual language only (`.st-*` + views-automations.css). No ZoruUI,
 * no Tailwind. The `.sabcrm-twenty` scope is applied by TwentyAppFrame.
 */

import * as React from 'react';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  Bell,
  Webhook,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listAutomationRulesAction,
  listAutomationRuleStatusesAction,
  createAutomationRuleAction,
  updateAutomationRuleAction,
  deleteAutomationRuleAction,
} from '@/app/actions/sabcrm.actions';
import type {
  AutomationRule,
  AutomationAction,
  AutomationRuleStatus,
} from '@/lib/sabcrm/automation.server';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import '../views-automations.css';

// ---------------------------------------------------------------------------
// Local catalogues
//
// Declared locally (rather than importing from the server-only automation
// module) so this client page never pulls a `server-only` guard into the
// bundle. Kept in sync with `AUTOMATION_EVENTS` / the action union.
// ---------------------------------------------------------------------------

type AutomationEvent =
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'activity_created'
  | 'field_changed';

type ActionType = AutomationAction['type'];

const EVENT_OPTIONS: ReadonlyArray<{ value: AutomationEvent; label: string }> = [
  { value: 'record_created', label: 'Record Created' },
  { value: 'record_updated', label: 'Record Updated' },
  { value: 'record_deleted', label: 'Record Deleted' },
  { value: 'activity_created', label: 'Activity Created' },
  { value: 'field_changed', label: 'Field Changed' },
];

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_OPTIONS.map((e) => [e.value, e.label]),
);

const ACTION_LABEL: Record<ActionType, string> = {
  create_task: 'Create Task',
  send_notification: 'Send Notification',
  call_webhook: 'Call Webhook',
};

const ACTION_ICON: Record<ActionType, React.ComponentType<{ size?: number }>> = {
  create_task: ClipboardList,
  send_notification: Bell,
  call_webhook: Webhook,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function actionSummary(action: AutomationAction): string {
  if (action.type === 'create_task') return `Create task: "${action.title}"`;
  if (action.type === 'send_notification') return `Notify: ${action.title}`;
  return `POST ${action.url}`;
}

type StatusKind = 'active' | 'failed' | 'ready' | 'disabled';

function statusOf(rule: AutomationRule, st: AutomationRuleStatus | undefined): StatusKind {
  const enabled = st?.enabled ?? rule.enabled;
  const lastFiredAt = st?.lastFiredAt ?? rule.lastFiredAt;
  const lastFailedAt = st?.lastFailedAt ?? rule.lastFailedAt;
  if (!enabled) return 'disabled';
  if (lastFailedAt && (!lastFiredAt || lastFailedAt > lastFiredAt)) return 'failed';
  if (lastFiredAt) return 'active';
  return 'ready';
}

const STATUS_META: Record<StatusKind, { className: string; label: string }> = {
  active: { className: 'st-chip--active', label: 'Active' },
  failed: { className: 'st-chip--failed', label: 'Failed' },
  ready: { className: 'st-chip--ready', label: 'Ready' },
  disabled: { className: 'st-chip--disabled-state', label: 'Disabled' },
};

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({ kind }: { kind: StatusKind }): React.JSX.Element {
  const meta = STATUS_META[kind];
  return (
    <span className={`st-chip ${meta.className}`}>
      <span className="st-chip__dot" aria-hidden="true" />
      <span className="st-chip__label">{meta.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Trigger → action flow cell
// ---------------------------------------------------------------------------

function FlowCell({ rule }: { rule: AutomationRule }): React.JSX.Element {
  const ActionIcon = ACTION_ICON[rule.action.type];
  return (
    <span className="st-flow">
      <span className="st-flow__seg">
        <Zap size={12} aria-hidden="true" />
        <span className="st-flow__strong">
          {EVENT_LABEL[rule.trigger.event] ?? rule.trigger.event}
        </span>
      </span>
      {rule.trigger.objectSlug ? (
        <span>
          on <span className="st-flow__obj">{rule.trigger.objectSlug}</span>
        </span>
      ) : (
        <span>on all objects</span>
      )}
      <span className="st-flow__arrow">
        <ChevronRight size={12} aria-hidden="true" />
      </span>
      <span className="st-flow__seg">
        <ActionIcon size={12} />
        <span>{actionSummary(rule.action)}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  description: string;
  enabled: boolean;
  event: AutomationEvent;
  objectSlug: string;
  actionType: ActionType;
  taskTitle: string;
  taskBody: string;
  taskAssigneeId: string;
  notifRecipientUserId: string;
  notifTitle: string;
  notifBody: string;
  webhookUrl: string;
  webhookSecret: string;
}

function initialForm(rule: AutomationRule | null): FormState {
  const base: FormState = {
    name: rule?.name ?? '',
    description: rule?.description ?? '',
    enabled: rule?.enabled ?? true,
    event: (rule?.trigger.event as AutomationEvent | undefined) ?? 'record_created',
    objectSlug: rule?.trigger.objectSlug ?? '',
    actionType: rule?.action.type ?? 'create_task',
    taskTitle: '',
    taskBody: '',
    taskAssigneeId: '',
    notifRecipientUserId: '',
    notifTitle: '',
    notifBody: '',
    webhookUrl: '',
    webhookSecret: '',
  };
  if (rule) {
    const a = rule.action;
    if (a.type === 'create_task') {
      base.taskTitle = a.title;
      base.taskBody = a.body ?? '';
      base.taskAssigneeId = a.assigneeId ?? '';
    } else if (a.type === 'send_notification') {
      base.notifRecipientUserId = a.recipientUserId;
      base.notifTitle = a.title;
      base.notifBody = a.body ?? '';
    } else if (a.type === 'call_webhook') {
      base.webhookUrl = a.url;
      base.webhookSecret = a.secret ?? '';
    }
  }
  return base;
}

function buildAction(form: FormState): AutomationAction | null {
  if (form.actionType === 'create_task') {
    if (!form.taskTitle.trim()) return null;
    return {
      type: 'create_task',
      title: form.taskTitle.trim(),
      ...(form.taskBody.trim() ? { body: form.taskBody.trim() } : {}),
      ...(form.taskAssigneeId.trim() ? { assigneeId: form.taskAssigneeId.trim() } : {}),
    };
  }
  if (form.actionType === 'send_notification') {
    if (!form.notifRecipientUserId.trim() || !form.notifTitle.trim()) return null;
    return {
      type: 'send_notification',
      recipientUserId: form.notifRecipientUserId.trim(),
      title: form.notifTitle.trim(),
      ...(form.notifBody.trim() ? { body: form.notifBody.trim() } : {}),
    };
  }
  if (!form.webhookUrl.trim()) return null;
  return {
    type: 'call_webhook',
    url: form.webhookUrl.trim(),
    ...(form.webhookSecret.trim() ? { secret: form.webhookSecret.trim() } : {}),
  };
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Rule name is required.';
  if (form.actionType === 'create_task' && !form.taskTitle.trim()) {
    return 'Task title is required for the Create Task action.';
  }
  if (form.actionType === 'send_notification') {
    if (!form.notifRecipientUserId.trim()) return 'Recipient user ID is required.';
    if (!form.notifTitle.trim()) return 'Notification title is required.';
  }
  if (form.actionType === 'call_webhook') {
    if (!form.webhookUrl.trim()) return 'Webhook URL is required.';
    if (!/^https?:\/\//i.test(form.webhookUrl.trim())) {
      return 'Webhook URL must start with https:// or http://';
    }
  }
  return null;
}

interface RuleDialogProps {
  projectId: string;
  existing: AutomationRule | null;
  onClose: () => void;
  onSaved: (rule: AutomationRule) => void;
}

function RuleDialog({ projectId, existing, onClose, onSaved }: RuleDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<FormState>(() => initialForm(existing));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const patch = React.useCallback((updates: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      const validationError = validate(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const action = buildAction(form);
      if (!action) {
        setError('Please fill in all required action fields.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        if (existing) {
          const res = await updateAutomationRuleAction(
            existing.id,
            {
              name: form.name.trim(),
              description: form.description.trim() || undefined,
              enabled: form.enabled,
              trigger: {
                event: form.event,
                objectSlug: form.objectSlug.trim() || undefined,
                conditions: existing.trigger.conditions,
              },
              action,
            },
            projectId,
          );
          if (res.ok) {
            onSaved(res.data);
            onClose();
          } else {
            setError(res.error);
          }
        } else {
          const res = await createAutomationRuleAction(
            {
              name: form.name.trim(),
              ...(form.description.trim() ? { description: form.description.trim() } : {}),
              enabled: form.enabled,
              trigger: {
                event: form.event,
                ...(form.objectSlug.trim() ? { objectSlug: form.objectSlug.trim() } : {}),
                conditions: [],
              },
              action,
            },
            projectId,
          );
          if (res.ok) {
            onSaved(res.data);
            onClose();
          } else {
            setError(res.error);
          }
        }
      } catch {
        setError('Failed to save the rule. The service may be unavailable.');
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
      aria-label={existing ? 'Edit automation rule' : 'New automation rule'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" style={{ maxWidth: 520 }}>
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">
            {existing ? 'Edit automation rule' : 'New automation rule'}
          </h2>
          <button type="button" className="st-dialog__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="st-dialog__body">
            {/* Identity */}
            <div className="st-field">
              <label className="st-field__label" htmlFor="rule-name">
                Name
                <span className="st-field__req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="rule-name"
                className="st-input"
                value={form.name}
                maxLength={120}
                autoComplete="off"
                autoFocus
                placeholder="e.g. Notify on new opportunity"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="rule-desc">
                Description
              </label>
              <textarea
                id="rule-desc"
                className="st-textarea"
                value={form.description}
                placeholder="Optional note about what this rule does"
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>

            <label className="st-checkbox-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              Enabled
            </label>

            {/* Trigger */}
            <div className="st-field">
              <label className="st-field__label" htmlFor="rule-event">
                Trigger event
                <span className="st-field__req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="rule-event"
                className="st-select"
                value={form.event}
                onChange={(e) => patch({ event: e.target.value as AutomationEvent })}
              >
                {EVENT_OPTIONS.map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="rule-object">
                Object slug
                <span className="st-field__hint">(optional — blank fires for all objects)</span>
              </label>
              <input
                id="rule-object"
                className="st-input"
                value={form.objectSlug}
                autoComplete="off"
                placeholder="e.g. opportunities"
                onChange={(e) => patch({ objectSlug: e.target.value.toLowerCase() })}
              />
            </div>

            {/* Action */}
            <div className="st-field">
              <label className="st-field__label" htmlFor="rule-action">
                Action
                <span className="st-field__req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="rule-action"
                className="st-select"
                value={form.actionType}
                onChange={(e) => patch({ actionType: e.target.value as ActionType })}
              >
                {(['create_task', 'send_notification', 'call_webhook'] as ActionType[]).map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {form.actionType === 'create_task' ? (
              <div className="st-subpanel">
                <div className="st-field">
                  <label className="st-field__label" htmlFor="task-title">
                    Task title
                    <span className="st-field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="task-title"
                    className="st-input"
                    value={form.taskTitle}
                    placeholder="e.g. Follow up with new lead"
                    onChange={(e) => patch({ taskTitle: e.target.value })}
                  />
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="task-body">
                    Description
                  </label>
                  <textarea
                    id="task-body"
                    className="st-textarea"
                    value={form.taskBody}
                    placeholder="Optional task description"
                    onChange={(e) => patch({ taskBody: e.target.value })}
                  />
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="task-assignee">
                    Assignee user ID
                    <span className="st-field__hint">
                      (optional — use <code>$record.assigneeId</code>)
                    </span>
                  </label>
                  <input
                    id="task-assignee"
                    className="st-input"
                    value={form.taskAssigneeId}
                    autoComplete="off"
                    placeholder="User ID or $record.assigneeId"
                    onChange={(e) => patch({ taskAssigneeId: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {form.actionType === 'send_notification' ? (
              <div className="st-subpanel">
                <div className="st-field">
                  <label className="st-field__label" htmlFor="notif-recipient">
                    Recipient user ID
                    <span className="st-field__req" aria-hidden="true">
                      *
                    </span>
                    <span className="st-field__hint">
                      (use <code>$record.assigneeId</code> for the record assignee)
                    </span>
                  </label>
                  <input
                    id="notif-recipient"
                    className="st-input"
                    value={form.notifRecipientUserId}
                    autoComplete="off"
                    placeholder="User ID or $record.assigneeId"
                    onChange={(e) => patch({ notifRecipientUserId: e.target.value })}
                  />
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="notif-title">
                    Title
                    <span className="st-field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="notif-title"
                    className="st-input"
                    value={form.notifTitle}
                    placeholder="Notification title"
                    onChange={(e) => patch({ notifTitle: e.target.value })}
                  />
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="notif-body">
                    Body
                  </label>
                  <textarea
                    id="notif-body"
                    className="st-textarea"
                    value={form.notifBody}
                    placeholder="Optional notification body"
                    onChange={(e) => patch({ notifBody: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {form.actionType === 'call_webhook' ? (
              <div className="st-subpanel">
                <div className="st-field">
                  <label className="st-field__label" htmlFor="webhook-url">
                    URL
                    <span className="st-field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="webhook-url"
                    className="st-input"
                    type="url"
                    value={form.webhookUrl}
                    autoComplete="off"
                    placeholder="https://example.com/webhook"
                    onChange={(e) => patch({ webhookUrl: e.target.value })}
                  />
                </div>
                <div className="st-field">
                  <label className="st-field__label" htmlFor="webhook-secret">
                    Secret
                    <span className="st-field__hint">
                      (optional — adds <code>X-SabCRM-Signature</code> header)
                    </span>
                  </label>
                  <input
                    id="webhook-secret"
                    className="st-input"
                    type="password"
                    value={form.webhookSecret}
                    autoComplete="new-password"
                    placeholder="Signing secret"
                    onChange={(e) => patch({ webhookSecret: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            {error ? <p className="st-form-error">{error}</p> : null}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </TwentyButton>
            <TwentyButton type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving…' : existing ? 'Save changes' : 'Create rule'}
            </TwentyButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  rule: AutomationRule;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteDialog({ rule, busy, onCancel, onConfirm }: DeleteDialogProps): React.JSX.Element {
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Delete automation rule"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="st-dialog">
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete automation rule</h2>
          <button type="button" className="st-dialog__close" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="st-dialog__body">
          <p style={{ margin: 0, color: 'var(--st-text-secondary)' }}>
            Delete <strong style={{ color: 'var(--st-text)' }}>{rule.name}</strong>? Future events
            matching this trigger will no longer fire its action. This cannot be undone.
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
            {busy ? 'Deleting…' : 'Delete rule'}
          </TwentyButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RulesSkeleton(): React.JSX.Element {
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

export default function SabcrmAutomationsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  const [rules, setRules] = React.useState<AutomationRule[]>([]);
  const [statuses, setStatuses] = React.useState<Record<string, AutomationRuleStatus>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AutomationRule | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const load = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, statusRes] = await Promise.all([
        listAutomationRulesAction(projectId),
        listAutomationRuleStatusesAction(projectId),
      ]);
      if (!rulesRes.ok) {
        setError(rulesRes.error);
        setRules([]);
        return;
      }
      setRules(rulesRes.data);
      if (statusRes.ok) {
        setStatuses(Object.fromEntries(statusRes.data.map((s) => [s.id, s])));
      }
    } catch {
      setError('Automation rules could not be loaded. The service may be unavailable.');
      setRules([]);
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

  const upsertRule = React.useCallback((rule: AutomationRule) => {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === rule.id);
      if (idx === -1) return [rule, ...prev];
      const next = [...prev];
      next[idx] = rule;
      return next;
    });
    setStatuses((prev) => ({
      ...prev,
      [rule.id]: {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        lastFiredAt: rule.lastFiredAt,
        lastFailedAt: rule.lastFailedAt,
        lastError: rule.lastError,
      },
    }));
  }, []);

  const handleToggle = React.useCallback(
    async (rule: AutomationRule) => {
      if (!activeProjectId) return;
      const next = !rule.enabled;
      setTogglingId(rule.id);
      setError(null);
      // Optimistic
      upsertRule({ ...rule, enabled: next });
      try {
        const res = await updateAutomationRuleAction(rule.id, { enabled: next }, activeProjectId);
        if (res.ok) {
          upsertRule(res.data);
        } else {
          upsertRule({ ...rule, enabled: rule.enabled });
          setError(res.error);
        }
      } catch {
        upsertRule({ ...rule, enabled: rule.enabled });
        setError('Failed to update the rule. The service may be unavailable.');
      } finally {
        setTogglingId(null);
      }
    },
    [activeProjectId, upsertRule],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteAutomationRuleAction(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        setError(res.error);
        setDeleteTarget(null);
      }
    } catch {
      setError('Failed to delete the rule. The service may be unavailable.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId]);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((rule: AutomationRule) => {
    setEditing(rule);
    setDialogOpen(true);
  }, []);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader
          title="Automations"
          icon={Zap}
          actions={
            activeProjectId ? (
              <TwentyButton variant="primary" icon={Plus} onClick={openCreate}>
                New rule
              </TwentyButton>
            ) : null
          }
        />
        <p className="st-settings__intro">
          Define event-driven rules that automatically create tasks, send
          notifications, or call webhooks when CRM records change. Managing rules
          requires the <code>sabcrm:admin</code> capability.
          {rules.length > 0 ? (
            <>
              {' '}
              {enabledCount} of {rules.length} {rules.length === 1 ? 'rule' : 'rules'} active.
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
          <RulesSkeleton />
        ) : !activeProjectId ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">Select a project to manage its automation rules.</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <Zap size={20} />
            </span>
            <h2 className="st-empty__title">No automation rules yet</h2>
            <p className="st-empty__desc">
              Create your first rule to automatically create tasks, send
              notifications, or call webhooks when CRM events occur.
            </p>
            <TwentyButton variant="secondary" icon={Plus} onClick={openCreate}>
              New rule
            </TwentyButton>
          </div>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger &amp; action</th>
                  <th>Status</th>
                  <th>Enabled</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const st = statuses[rule.id];
                  const kind = statusOf(rule, st);
                  const lastFiredAt = st?.lastFiredAt ?? rule.lastFiredAt;
                  const lastFailedAt = st?.lastFailedAt ?? rule.lastFailedAt;
                  return (
                    <tr key={rule.id} className="st-row">
                      <td>
                        <span className="st-cell-link">{rule.name}</span>
                        {rule.description ? (
                          <div className="st-identity__sub">{rule.description}</div>
                        ) : null}
                        <div className="st-meta" style={{ marginTop: 4 }}>
                          <span>Fired: {relativeTime(lastFiredAt)}</span>
                          {kind === 'failed' ? (
                            <span className="st-meta__fail" title={st?.lastError ?? rule.lastError}>
                              <AlertTriangle size={11} />
                              Failed {relativeTime(lastFailedAt)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <FlowCell rule={rule} />
                      </td>
                      <td>
                        <StatusChip kind={kind} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`st-switch${rule.enabled ? ' is-on' : ''}`}
                          role="switch"
                          aria-checked={rule.enabled}
                          aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                          disabled={togglingId === rule.id}
                          onClick={() => void handleToggle(rule)}
                        />
                      </td>
                      <td className="st-cell-actions">
                        <TwentyButton
                          variant="ghost"
                          icon={Pencil}
                          onClick={() => openEdit(rule)}
                          title="Edit rule"
                        >
                          Edit
                        </TwentyButton>
                        <TwentyButton
                          variant="ghost"
                          icon={Trash2}
                          className="st-btn--danger"
                          onClick={() => setDeleteTarget(rule)}
                          title="Delete rule"
                        >
                          Delete
                        </TwentyButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && activeProjectId ? (
        <RuleDialog
          projectId={activeProjectId}
          existing={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={upsertRule}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteDialog
          rule={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
