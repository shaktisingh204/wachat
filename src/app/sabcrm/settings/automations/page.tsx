'use client';

/**
 * SabCRM Settings — Automation Rules
 * Route: /sabcrm/settings/automations
 *
 * Admin-gated page for listing, creating, toggling enabled/disabled, and
 * deleting simple automation rules.
 *
 * Interactivity:
 *   - List all rules via `listAutomationRulesAction` (gate: 'edit')
 *   - Toggle enabled via `updateAutomationRuleAction` (gate: 'edit')
 *   - Create new rules via a sheet form + `createAutomationRuleAction`
 *   - Delete rules via confirm dialog + `deleteAutomationRuleAction`
 *
 * All mutations go through the existing gated server actions in
 * `src/app/actions/sabcrm.actions.ts`. The gate enforces:
 *   session → project → RBAC (sabcrm:admin capability → 'edit') → plan → Mongo
 *
 * Auth / project guards are enforced upstream by `../../layout.tsx`.
 * The server actions independently re-run the full gate so direct API
 * access also fails closed.
 *
 * UI: ZoruUI only (black-and-white). No raw Tailwind accent colours.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Zap,
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Info,
  Webhook,
  Bell,
  ClipboardList,
} from 'lucide-react';

import {
  Button,
  Input,
  Textarea,
  Label,
  Switch,
  Badge,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  Separator,
  Skeleton,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogTrigger,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogFooter,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  Sheet,
  ZoruSheetTrigger,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  ZoruSheetFooter,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Tooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
} from '@/components/zoruui';

import { useProject } from '@/context/project-context';
import {
  listAutomationRulesAction,
  createAutomationRuleAction,
  updateAutomationRuleAction,
  deleteAutomationRuleAction,
} from '@/app/actions/sabcrm.actions';
import type {
  AutomationRule,
  AutomationAction,
} from '@/lib/sabcrm/automation.server';
import { AUTOMATION_EVENTS, type AutomationEvent } from '@/lib/sabcrm/automation-events';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CRM_SETTINGS_PATH = '/sabcrm/settings';

const EVENT_LABELS: Record<AutomationEvent, string> = {
  record_created: 'Record Created',
  record_updated: 'Record Updated',
  record_deleted: 'Record Deleted',
  activity_created: 'Activity Created',
  field_changed: 'Field Changed',
};

const ACTION_TYPE_LABELS: Record<AutomationAction['type'], string> = {
  create_task: 'Create Task',
  send_notification: 'Send Notification',
  call_webhook: 'Call Webhook',
};

const ACTION_TYPE_ICONS: Record<AutomationAction['type'], React.ElementType> = {
  create_task: ClipboardList,
  send_notification: Bell,
  call_webhook: Webhook,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Rule status badge
// ---------------------------------------------------------------------------

interface RuleStatusBadgeProps {
  rule: AutomationRule;
}

function RuleStatusBadge({ rule }: RuleStatusBadgeProps) {
  if (!rule.enabled) {
    return (
      <Badge variant="secondary" className="inline-flex items-center gap-1 text-xs">
        <Circle className="h-2.5 w-2.5" />
        Disabled
      </Badge>
    );
  }
  if (rule.lastFailedAt && (!rule.lastFiredAt || rule.lastFailedAt > rule.lastFiredAt)) {
    return (
      <Badge variant="destructive" className="inline-flex items-center gap-1 text-xs">
        <XCircle className="h-2.5 w-2.5" />
        Failed
      </Badge>
    );
  }
  if (rule.lastFiredAt) {
    return (
      <Badge variant="default" className="inline-flex items-center gap-1 text-xs">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="inline-flex items-center gap-1 text-xs">
      <Circle className="h-2.5 w-2.5" />
      Ready
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Rule card
// ---------------------------------------------------------------------------

interface RuleCardProps {
  rule: AutomationRule;
  toggling: boolean;
  deleting: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

function RuleCard({ rule, toggling, deleting, onToggle, onDelete }: RuleCardProps) {
  const ActionIcon = ACTION_TYPE_ICONS[rule.action.type];
  const actionLabel = ACTION_TYPE_LABELS[rule.action.type];
  const eventLabel = EVENT_LABELS[rule.trigger.event] ?? rule.trigger.event;

  // Derive a one-line summary of the action for the card subtitle
  function getActionSummary(): string {
    const a = rule.action;
    if (a.type === 'create_task') return `Create task: "${a.title}"`;
    if (a.type === 'send_notification') return `Notify: ${a.title}`;
    if (a.type === 'call_webhook') return `POST ${a.url}`;
    return actionLabel;
  }

  return (
    <Card variant="soft" className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Top strip: name + badges */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zoru-ink truncate">
              {rule.name}
            </span>
            <RuleStatusBadge rule={rule} />
          </div>
          {rule.description && (
            <p className="text-xs text-zoru-ink-muted leading-snug line-clamp-2">
              {rule.description}
            </p>
          )}
        </div>

        {/* Enable / disable toggle */}
        <ZoruTooltipProvider>
          <Tooltip>
            <ZoruTooltipTrigger asChild>
              <span>
                <Switch
                  checked={rule.enabled}
                  disabled={toggling || deleting}
                  onCheckedChange={(checked) => onToggle(rule.id, checked)}
                  aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                />
              </span>
            </ZoruTooltipTrigger>
            <ZoruTooltipContent side="top">
              {rule.enabled ? 'Disable rule' : 'Enable rule'}
            </ZoruTooltipContent>
          </Tooltip>
        </ZoruTooltipProvider>
      </div>

      <Separator />

      {/* Trigger → Action summary */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap text-xs text-zoru-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 shrink-0" aria-hidden />
          <span className="font-medium text-zoru-ink">{eventLabel}</span>
        </span>
        {rule.trigger.objectSlug && (
          <span className="text-zoru-ink-subtle">
            on <span className="font-mono">{rule.trigger.objectSlug}</span>
          </span>
        )}
        {rule.trigger.conditions.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {rule.trigger.conditions.length}{' '}
            {rule.trigger.conditions.length === 1 ? 'condition' : 'conditions'}
          </Badge>
        )}
        <ChevronRight className="h-3 w-3 shrink-0 text-zoru-ink-subtle" aria-hidden />
        <span className="inline-flex items-center gap-1">
          <ActionIcon className="h-3 w-3 shrink-0" aria-hidden />
          <span>{getActionSummary()}</span>
        </span>
      </div>

      <Separator />

      {/* Footer: execution info + delete */}
      <div className="px-5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[11px] text-zoru-ink-subtle">
          <span>
            Fired:{' '}
            <span className="text-zoru-ink-muted">
              {formatRelativeTime(rule.lastFiredAt)}
            </span>
          </span>
          {rule.lastFailedAt &&
            (!rule.lastFiredAt || rule.lastFailedAt > rule.lastFiredAt) && (
              <ZoruTooltipProvider>
                <Tooltip>
                  <ZoruTooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-destructive cursor-help">
                      <AlertTriangle className="h-3 w-3" />
                      Failed {formatRelativeTime(rule.lastFailedAt)}
                    </span>
                  </ZoruTooltipTrigger>
                  <ZoruTooltipContent side="bottom" className="max-w-xs">
                    <p className="font-mono text-[11px] break-all">
                      {rule.lastError ?? 'Unknown error'}
                    </p>
                  </ZoruTooltipContent>
                </Tooltip>
              </ZoruTooltipProvider>
            )}
        </div>

        {/* Delete confirmation */}
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={deleting || toggling}
              aria-label={`Delete rule "${rule.name}"`}
              className="text-zoru-ink-muted hover:text-destructive"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Delete automation rule?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                <strong>&ldquo;{rule.name}&rdquo;</strong> will be permanently deleted.
                Any future events matching this trigger will no longer fire this action.
                This cannot be undone.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={() => onDelete(rule.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create rule form (sheet)
// ---------------------------------------------------------------------------

type ActionType = AutomationAction['type'];

interface FormState {
  name: string;
  description: string;
  enabled: boolean;
  event: AutomationEvent;
  objectSlug: string;
  // Action fields
  actionType: ActionType;
  // create_task fields
  taskTitle: string;
  taskBody: string;
  taskAssigneeId: string;
  // send_notification fields
  notifRecipientUserId: string;
  notifTitle: string;
  notifBody: string;
  // call_webhook fields
  webhookUrl: string;
  webhookSecret: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  enabled: true,
  event: 'record_created',
  objectSlug: '',
  actionType: 'create_task',
  taskTitle: '',
  taskBody: '',
  taskAssigneeId: '',
  notifRecipientUserId: '',
  notifTitle: '',
  notifBody: '',
  webhookUrl: '',
  webhookSecret: '',
};

function buildAction(form: FormState): AutomationAction | null {
  if (form.actionType === 'create_task') {
    if (!form.taskTitle.trim()) return null;
    return {
      type: 'create_task',
      title: form.taskTitle.trim(),
      ...(form.taskBody.trim() ? { body: form.taskBody.trim() } : {}),
      ...(form.taskAssigneeId.trim()
        ? { assigneeId: form.taskAssigneeId.trim() }
        : {}),
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
  if (form.actionType === 'call_webhook') {
    if (!form.webhookUrl.trim()) return null;
    return {
      type: 'call_webhook',
      url: form.webhookUrl.trim(),
      ...(form.webhookSecret.trim() ? { secret: form.webhookSecret.trim() } : {}),
    };
  }
  return null;
}

interface CreateRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
  onCreated: (rule: AutomationRule) => void;
}

function CreateRuleSheet({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: CreateRuleSheetProps) {
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Reset when sheet opens
  React.useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setFormError(null);
    }
  }, [open]);

  function patch(updates: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function getFormError(): string | null {
    if (!form.name.trim()) return 'Rule name is required.';
    if (form.actionType === 'create_task' && !form.taskTitle.trim()) {
      return 'Task title is required for the Create Task action.';
    }
    if (form.actionType === 'send_notification') {
      if (!form.notifRecipientUserId.trim())
        return 'Recipient user ID is required for the Send Notification action.';
      if (!form.notifTitle.trim())
        return 'Notification title is required.';
    }
    if (form.actionType === 'call_webhook') {
      if (!form.webhookUrl.trim()) return 'Webhook URL is required.';
      if (!/^https?:\/\//i.test(form.webhookUrl.trim())) {
        return 'Webhook URL must start with https:// or http://';
      }
    }
    return null;
  }

  async function handleSave() {
    const validationError = getFormError();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const action = buildAction(form);
    if (!action) {
      setFormError('Please fill in all required action fields.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const result = await createAutomationRuleAction(
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

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    onCreated(result.data);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <ZoruSheetHeader className="px-6 pt-6 pb-4 border-b border-zoru-line">
          <ZoruSheetTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-zoru-ink-muted" aria-hidden />
            New automation rule
          </ZoruSheetTitle>
          <ZoruSheetDescription className="text-xs">
            Define a trigger event and an action that runs automatically when
            the trigger fires.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Identity */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Identity
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="rule-name" className="text-sm">
                Name <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Notify on new opportunity"
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-description" className="text-sm">
                Description
              </Label>
              <Textarea
                id="rule-description"
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Optional note about what this rule does"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onCheckedChange={(c) => patch({ enabled: c })}
              />
              <Label htmlFor="rule-enabled" className="text-sm cursor-pointer">
                Enabled
              </Label>
            </div>
          </section>

          <Separator />

          {/* Trigger */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Trigger
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="rule-event" className="text-sm">
                Event <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Select
                value={form.event}
                onValueChange={(v) => patch({ event: v as AutomationEvent })}
              >
                <ZoruSelectTrigger id="rule-event">
                  <ZoruSelectValue placeholder="Select event" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {AUTOMATION_EVENTS.map((ev) => (
                    <ZoruSelectItem key={ev} value={ev}>
                      {EVENT_LABELS[ev]}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-object" className="text-sm">
                Object slug
                <span className="ml-1 text-xs text-zoru-ink-muted font-normal">
                  (optional — leave blank for all objects)
                </span>
              </Label>
              <Input
                id="rule-object"
                value={form.objectSlug}
                onChange={(e) => patch({ objectSlug: e.target.value.toLowerCase() })}
                placeholder="e.g. opportunities"
                autoComplete="off"
              />
            </div>
          </section>

          <Separator />

          {/* Action */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Action
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="rule-action-type" className="text-sm">
                Action type <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Select
                value={form.actionType}
                onValueChange={(v) => patch({ actionType: v as ActionType })}
              >
                <ZoruSelectTrigger id="rule-action-type">
                  <ZoruSelectValue placeholder="Select action" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="create_task">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Create Task
                    </span>
                  </ZoruSelectItem>
                  <ZoruSelectItem value="send_notification">
                    <span className="flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5" />
                      Send Notification
                    </span>
                  </ZoruSelectItem>
                  <ZoruSelectItem value="call_webhook">
                    <span className="flex items-center gap-2">
                      <Webhook className="h-3.5 w-3.5" />
                      Call Webhook
                    </span>
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>

            {/* Create Task fields */}
            {form.actionType === 'create_task' && (
              <div className="space-y-3 rounded-lg border border-zoru-line bg-zoru-surface p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="task-title" className="text-sm">
                    Task title <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="task-title"
                    value={form.taskTitle}
                    onChange={(e) => patch({ taskTitle: e.target.value })}
                    placeholder="e.g. Follow up with new lead"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-body" className="text-sm">
                    Description
                  </Label>
                  <Textarea
                    id="task-body"
                    value={form.taskBody}
                    onChange={(e) => patch({ taskBody: e.target.value })}
                    placeholder="Optional task description"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-assignee" className="text-sm">
                    Assignee user ID
                    <span className="ml-1 text-xs text-zoru-ink-muted font-normal">
                      (optional — use <code className="font-mono text-[11px]">$record.assigneeId</code> to inherit from record)
                    </span>
                  </Label>
                  <Input
                    id="task-assignee"
                    value={form.taskAssigneeId}
                    onChange={(e) => patch({ taskAssigneeId: e.target.value })}
                    placeholder="User ID or $record.assigneeId"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* Send Notification fields */}
            {form.actionType === 'send_notification' && (
              <div className="space-y-3 rounded-lg border border-zoru-line bg-zoru-surface p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="notif-recipient" className="text-sm">
                    Recipient user ID <span className="text-destructive" aria-hidden>*</span>
                    <span className="ml-1 text-xs text-zoru-ink-muted font-normal">
                      (use <code className="font-mono text-[11px]">$record.assigneeId</code> to notify the record's assignee)
                    </span>
                  </Label>
                  <Input
                    id="notif-recipient"
                    value={form.notifRecipientUserId}
                    onChange={(e) => patch({ notifRecipientUserId: e.target.value })}
                    placeholder="User ID or $record.assigneeId"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-title" className="text-sm">
                    Title <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="notif-title"
                    value={form.notifTitle}
                    onChange={(e) => patch({ notifTitle: e.target.value })}
                    placeholder="Notification title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-body" className="text-sm">
                    Body
                  </Label>
                  <Textarea
                    id="notif-body"
                    value={form.notifBody}
                    onChange={(e) => patch({ notifBody: e.target.value })}
                    placeholder="Optional notification body"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {/* Call Webhook fields */}
            {form.actionType === 'call_webhook' && (
              <div className="space-y-3 rounded-lg border border-zoru-line bg-zoru-surface p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-url" className="text-sm">
                    URL <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    value={form.webhookUrl}
                    onChange={(e) => patch({ webhookUrl: e.target.value })}
                    placeholder="https://example.com/webhook"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-secret" className="text-sm">
                    Secret
                    <span className="ml-1 text-xs text-zoru-ink-muted font-normal">
                      (optional — adds <code className="font-mono text-[11px]">X-SabCRM-Signature</code> header)
                    </span>
                  </Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    value={form.webhookSecret}
                    onChange={(e) => patch({ webhookSecret: e.target.value })}
                    placeholder="Signing secret"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-start gap-2 text-[11px] text-zoru-ink-muted leading-snug">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
                  <span>
                    SabCRM POSTs a JSON body with the event, record snapshot, and a
                    timestamp. Redirects are not followed. Timeout: 10 s.
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Form-level error */}
          {formError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <ZoruAlertTitle>Cannot save rule</ZoruAlertTitle>
              <ZoruAlertDescription>{formError}</ZoruAlertDescription>
            </Alert>
          )}
        </div>

        <ZoruSheetFooter className="px-6 py-4 border-t border-zoru-line flex-row gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create rule
              </>
            )}
          </Button>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function RulesListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAutomationsPage() {
  const { activeProjectId } = useProject();

  const [rules, setRules] = React.useState<AutomationRule[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = React.useState(false);

  // Per-rule operation states: id → boolean
  const [toggling, setToggling] = React.useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = React.useState<Record<string, boolean>>({});

  // Toast / inline feedback
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const pid = activeProjectId ?? undefined;

  // ---------------------------------------------------------------------------
  // Load rules
  // ---------------------------------------------------------------------------

  const loadRules = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await listAutomationRulesAction(pid);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setRules(result.data);
  }, [pid]);

  React.useEffect(() => {
    void loadRules();
  }, [loadRules]);

  // Auto-dismiss feedback after 4 s
  React.useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // ---------------------------------------------------------------------------
  // Toggle enabled
  // ---------------------------------------------------------------------------

  async function handleToggle(id: string, enabled: boolean) {
    setToggling((prev) => ({ ...prev, [id]: true }));

    // Optimistic update
    setRules((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, enabled } : r)) : prev,
    );

    const result = await updateAutomationRuleAction(id, { enabled }, pid);

    setToggling((prev) => ({ ...prev, [id]: false }));

    if (!result.ok) {
      // Revert optimistic update
      setRules((prev) =>
        prev ? prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)) : prev,
      );
      setFeedback({ type: 'error', message: result.error });
    } else {
      setFeedback({
        type: 'success',
        message: enabled ? 'Rule enabled.' : 'Rule disabled.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(id: string) {
    setDeleting((prev) => ({ ...prev, [id]: true }));
    const result = await deleteAutomationRuleAction(id, pid);
    setDeleting((prev) => ({ ...prev, [id]: false }));

    if (!result.ok) {
      setFeedback({ type: 'error', message: result.error });
      return;
    }

    setRules((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    setFeedback({ type: 'success', message: 'Automation rule deleted.' });
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  function handleCreated(rule: AutomationRule) {
    setRules((prev) => (prev ? [rule, ...prev] : [rule]));
    setFeedback({ type: 'success', message: `Rule "${rule.name}" created.` });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const enabledCount = rules?.filter((r) => r.enabled).length ?? 0;
  const totalCount = rules?.length ?? 0;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">

      {/* Page header */}
      <PageHeader className="mb-8">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            <Link
              href={CRM_SETTINGS_PATH}
              className="inline-flex items-center gap-1 text-zoru-ink-muted hover:text-zoru-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Settings
            </Link>
            <span className="mx-1 text-zoru-ink-muted">/</span>
            Automations
          </ZoruPageEyebrow>
          <ZoruPageTitle>
            <span className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-zoru-ink-muted" aria-hidden />
              Automations
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Define event-driven rules that automatically create tasks, send
            notifications, or call webhooks when CRM records change.
            {rules !== null && (
              <span className="ml-2 text-zoru-ink">
                {enabledCount} of {totalCount} rule{totalCount !== 1 ? 's' : ''} active.
              </span>
            )}
          </ZoruPageDescription>
        </ZoruPageHeading>

        <ZoruPageActions>
          <Button
            onClick={() => setSheetOpen(true)}
            disabled={loading}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New rule
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* Inline feedback banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'mb-6 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm',
            feedback.type === 'success'
              ? 'border-zoru-line bg-zoru-surface text-zoru-ink'
              : 'border-destructive/30 bg-destructive/5 text-destructive',
          ].join(' ')}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Failed to load automations</ZoruAlertTitle>
          <ZoruAlertDescription>
            {loadError}{' '}
            <button
              onClick={() => void loadRules()}
              className="underline underline-offset-2 hover:no-underline"
            >
              Retry
            </button>
          </ZoruAlertDescription>
        </Alert>
      )}

      {/* Content */}
      {loading ? (
        <RulesListSkeleton />
      ) : rules !== null && rules.length === 0 ? (
        <EmptyState
          icon={<Zap className="h-10 w-10 text-zoru-ink-muted" />}
          title="No automation rules yet"
          description="Create your first rule to automatically create tasks, send notifications, or call webhooks when CRM events occur."
          action={
            <Button onClick={() => setSheetOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New rule
            </Button>
          }
        />
      ) : rules !== null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              toggling={toggling[rule.id] ?? false}
              deleting={deleting[rule.id] ?? false}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}

      {/* Info card when rules exist */}
      {rules !== null && rules.length > 0 && (
        <Card variant="soft" className="mt-8">
          <ZoruCardHeader>
            <ZoruCardTitle className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-zoru-ink-muted" aria-hidden />
              How automations work
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="pt-0">
            <ul className="space-y-2 text-sm text-zoru-ink-muted">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink-subtle" />
                Rules fire <strong className="text-zoru-ink">fire-and-forget</strong> — they
                never block or delay the record operation that triggered them.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink-subtle" />
                A <strong className="text-zoru-ink">field_changed</strong> rule fires only
                when one of its conditions references a field that actually changed in the update.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink-subtle" />
                Webhook calls are bounded to a <strong className="text-zoru-ink">10 s timeout</strong>{' '}
                and retry once on network failure.{' '}
                Use the optional signing secret to verify authenticity via{' '}
                <code className="font-mono text-[11px] rounded bg-zoru-surface-2 px-1">
                  X-SabCRM-Signature
                </code>
                .
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink-subtle" />
                Assign <code className="font-mono text-[11px] rounded bg-zoru-surface-2 px-1">
                  $record.assigneeId
                </code>{' '}
                as the task assignee or notification recipient to dynamically resolve the
                record's current assignee at run time.
              </li>
            </ul>
          </ZoruCardContent>
        </Card>
      )}

      {/* Create sheet */}
      <CreateRuleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projectId={pid}
        onCreated={handleCreated}
      />
    </main>
  );
}
