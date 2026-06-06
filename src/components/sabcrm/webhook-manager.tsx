'use client';

/**
 * SabCRM — Webhook Manager
 *
 * A self-contained client component for managing outbound webhook subscriptions
 * on the API settings page. Features:
 *   - List all subscriptions (url, events, active status, last delivery info)
 *   - Add a new subscription (url, events, optional description)
 *   - Edit an existing subscription (url, events, description, active toggle)
 *   - Rotate the signing secret (shown once, never re-fetched)
 *   - Delete a subscription (confirmation dialog)
 *   - Copy the revealed secret to clipboard
 *
 * All mutations call the gated server actions in `sabcrm.actions.ts`.
 * The `secret` is surfaced only at create/rotate time; the component clears
 * it the moment the user dismisses the reveal dialog.
 *
 * Pure ZoruUI (black-and-white). No free-text URL inputs for files; this
 * component deals only with HTTP endpoints (not file sources), so no SabFiles
 * integration is needed here.
 *
 * Usage:
 *   <WebhookManager projectId="..." />
 *   <WebhookManager />   // uses first project from session
 */

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Webhook,
  Pencil,
  X,
  ShieldCheck,
  Circle,
  CheckCircle,
} from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, CardDescription, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Input, Label, Separator, Skeleton, Switch, Textarea, Tooltip, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, TooltipContent, TooltipProvider, TooltipTrigger, cn, useToast } from '@/components/sabcrm/20ui/compat';

import {
  createWebhookAction,
  deleteWebhookAction,
  listWebhooksAction,
  rotateWebhookSecretAction,
  updateWebhookAction,
} from '@/app/actions/sabcrm.actions';
import { SABCRM_WEBHOOK_EVENTS } from '@/lib/sabcrm/webhook-events';
import type {
  CreateWebhookInput,
  UpdateWebhookPatch,
  WebhookSubscription,
} from '@/app/actions/sabcrm.actions.types';

// SabcrmWebhookEvent is an `import type` — erased at build time, so the
// `server-only` guard in webhooks.server.ts never executes at runtime. This
// is consistent with how every other server-typed shape is used in client
// components across SabNode (see object-editor.tsx, field-editor.tsx, etc.).
import type { SabcrmWebhookEvent } from '@/lib/sabcrm/webhooks.server';

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Human labels for each event, in the same order as SABCRM_WEBHOOK_EVENTS. */
const EVENT_LABELS: Record<SabcrmWebhookEvent, string> = {
  'record.created': 'Record Created',
  'record.updated': 'Record Updated',
  'record.deleted': 'Record Deleted',
  'activity.created': 'Activity Created',
};

/** Human description for each event. */
const EVENT_DESCRIPTIONS: Record<SabcrmWebhookEvent, string> = {
  'record.created': 'Fires when any CRM record is created.',
  'record.updated': 'Fires when a CRM record\'s data changes.',
  'record.deleted': 'Fires when a CRM record is removed.',
  'activity.created': 'Fires when a note, task, call, or comment is logged.',
};

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

/** Redacted secret pill — just shows "••••••••" with a "set" badge. */
function SecretPill({ hasSecret }: { hasSecret: boolean }): React.ReactElement {
  if (!hasSecret) {
    return (
      <span className="text-xs text-zinc-400 font-mono">no secret</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500">
      <ShieldCheck className="h-3 w-3 text-zinc-400" />
      ••••••••
    </span>
  );
}

/** Status badge: active (solid) vs disabled (outline muted). */
function StatusBadge({ active, failureCount }: { active: boolean; failureCount: number }): React.ReactElement {
  if (!active) {
    return (
      <Badge
        variant="outline"
        className="border-zinc-300 text-zinc-400 text-xs gap-1"
      >
        <Circle className="h-2 w-2 fill-zinc-300" />
        Disabled
      </Badge>
    );
  }
  if (failureCount > 0) {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-600 text-xs gap-1"
      >
        <AlertTriangle className="h-2.5 w-2.5" />
        {failureCount} failures
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-zinc-800 text-zinc-800 text-xs gap-1"
    >
      <CheckCircle className="h-2.5 w-2.5" />
      Active
    </Badge>
  );
}

/** Inline skeleton for the list loading state. */
function WebhookListSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border border-zinc-100 rounded-lg p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Event picker                                                                */
/* -------------------------------------------------------------------------- */

interface EventPickerProps {
  selected: SabcrmWebhookEvent[];
  onChange: (events: SabcrmWebhookEvent[]) => void;
  disabled?: boolean;
}

function EventPicker({ selected, onChange, disabled }: EventPickerProps): React.ReactElement {
  function toggle(event: SabcrmWebhookEvent): void {
    if (selected.includes(event)) {
      onChange(selected.filter((e) => e !== event));
    } else {
      onChange([...selected, event]);
    }
  }

  return (
    <div className="space-y-2">
      {(SABCRM_WEBHOOK_EVENTS as readonly SabcrmWebhookEvent[]).map((event) => {
        const checked = selected.includes(event);
        return (
          <label
            key={event}
            className={cn(
              'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
              checked
                ? 'border-zinc-900 bg-zinc-50'
                : 'border-zinc-200 hover:border-zinc-300',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => !disabled && toggle(event)}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 leading-none mb-0.5">
                {EVENT_LABELS[event]}
              </p>
              <p className="text-xs text-zinc-500">{EVENT_DESCRIPTIONS[event]}</p>
              <code className="text-xs text-zinc-400 font-mono mt-1 block">
                {event}
              </code>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Secret reveal panel                                                         */
/* -------------------------------------------------------------------------- */

interface SecretRevealPanelProps {
  secret: string;
  onDismiss: () => void;
}

function SecretRevealPanel({ secret, onDismiss }: SecretRevealPanelProps): React.ReactElement {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  function copySecret(): void {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      toast({ title: 'Secret copied', description: 'Store it securely — it will not be shown again.' });
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-white mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">Signing secret</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            This is shown only once. Store it securely and use it to verify
            incoming webhook payloads via the{' '}
            <code className="text-zinc-300">X-SabNode-Signature</code> header.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-xs text-white break-all select-all bg-zinc-900 rounded px-3 py-2 border border-zinc-700">
          {visible ? secret : '•'.repeat(Math.min(secret.length, 64))}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
                onClick={() => setVisible((v) => !v)}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{visible ? 'Hide' : 'Show'} secret</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
                onClick={copySecret}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <ClipboardCopy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy secret</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        onClick={onDismiss}
      >
        I have saved the secret
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add / Edit dialog                                                           */
/* -------------------------------------------------------------------------- */

interface WebhookFormState {
  url: string;
  events: SabcrmWebhookEvent[];
  description: string;
  active: boolean;
}

function emptyForm(): WebhookFormState {
  return { url: '', events: [], description: '', active: true };
}

function formFromSubscription(sub: WebhookSubscription): WebhookFormState {
  return {
    url: sub.url,
    events: [...sub.events],
    description: sub.description ?? '',
    active: sub.active,
  };
}

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits the subscription; otherwise creates a new one. */
  subscription?: WebhookSubscription;
  projectId?: string;
  onCreated: (sub: WebhookSubscription) => void;
  onUpdated: (sub: WebhookSubscription) => void;
}

function WebhookFormDialog({
  open,
  onOpenChange,
  subscription,
  projectId,
  onCreated,
  onUpdated,
}: WebhookFormDialogProps): React.ReactElement {
  const { toast } = useToast();
  const isEdit = Boolean(subscription);

  const [form, setForm] = React.useState<WebhookFormState>(
    subscription ? formFromSubscription(subscription) : emptyForm(),
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form when dialog opens for a different subscription.
  React.useEffect(() => {
    if (open) {
      setForm(subscription ? formFromSubscription(subscription) : emptyForm());
      setError(null);
    }
  }, [open, subscription]);

  function setField<K extends keyof WebhookFormState>(
    key: K,
    value: WebhookFormState[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!form.url.trim()) {
      setError('Endpoint URL is required.');
      return;
    }
    if (form.events.length === 0) {
      setError('Select at least one event to subscribe to.');
      return;
    }

    setBusy(true);
    setError(null);

    if (isEdit && subscription) {
      const patch: UpdateWebhookPatch = {};
      if (form.url.trim() !== subscription.url) patch.url = form.url.trim();
      if (JSON.stringify([...form.events].sort()) !== JSON.stringify([...subscription.events].sort())) {
        patch.events = form.events;
      }
      const newDesc = form.description.trim() || undefined;
      if (newDesc !== subscription.description) patch.description = form.description.trim();
      if (form.active !== subscription.active) patch.active = form.active;

      if (Object.keys(patch).length === 0) {
        onOpenChange(false);
        setBusy(false);
        return;
      }

      const result = await updateWebhookAction(subscription._id, patch, projectId);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ title: 'Webhook updated' });
      onUpdated(result.data);
      onOpenChange(false);
    } else {
      const input: CreateWebhookInput = {
        url: form.url.trim(),
        events: form.events,
        description: form.description.trim() || undefined,
        active: form.active,
      };
      const result = await createWebhookAction(input, projectId);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast({ title: 'Webhook created', description: 'Copy the signing secret below — it will not be shown again.' });
      onCreated(result.data);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg zoruui">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit webhook' : 'Add webhook'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the endpoint url, subscribed events, or active status.'
              : 'Register an HTTPS endpoint that SabCRM will POST to when subscribed events fire.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5 py-2">
          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="whm-url">Endpoint URL</Label>
            <Input
              id="whm-url"
              type="url"
              placeholder="https://example.com/webhook"
              value={form.url}
              onChange={(e) => setField('url', e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="whm-desc">Description (optional)</Label>
            <Textarea
              id="whm-desc"
              placeholder="e.g. Sync to Slack #crm-alerts"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              disabled={busy}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>Subscribe to events</Label>
            <EventPicker
              selected={form.events}
              onChange={(events) => setField('events', events)}
              disabled={busy}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Active</p>
                <p className="text-xs text-zinc-500">
                  Disabled webhooks are skipped during dispatch.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setField('active', v)}
                disabled={busy}
              />
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Subscription row (expanded detail view)                                    */
/* -------------------------------------------------------------------------- */

interface SubscriptionRowProps {
  subscription: WebhookSubscription;
  revealedSecret: string | null;
  onSecretDismiss: () => void;
  onEdit: () => void;
  onRotate: () => void;
  onDelete: () => void;
  isRotating: boolean;
}

function SubscriptionRow({
  subscription,
  revealedSecret,
  onSecretDismiss,
  onEdit,
  onRotate,
  onDelete,
  isRotating,
}: SubscriptionRowProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false);

  const lastDelivery = subscription.lastDeliveryAt
    ? new Date(subscription.lastDeliveryAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Webhook className="h-4 w-4 text-zinc-400 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-zinc-900 truncate max-w-xs">
              {subscription.url}
            </span>
            <StatusBadge active={subscription.active} failureCount={subscription.failureCount} />
          </div>
          {subscription.description && (
            <p className="text-xs text-zinc-500 mt-0.5">{subscription.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {subscription.events.map((ev) => (
              <Badge
                key={ev}
                variant="outline"
                className="text-xs font-mono border-zinc-200 text-zinc-600 py-0"
              >
                {ev}
              </Badge>
            ))}
          </div>
        </div>

        {/* Row actions */}
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                  onClick={onEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit webhook</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{expanded ? 'Collapse' : 'Expand'} details</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-4 bg-zinc-50 space-y-4">
          {/* Revealed secret (create/rotate only) */}
          {revealedSecret && (
            <SecretRevealPanel secret={revealedSecret} onDismiss={onSecretDismiss} />
          )}

          {/* Delivery status */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <p className="text-zinc-400 mb-0.5">Signing secret</p>
              <SecretPill hasSecret={subscription.hasSecret} />
            </div>
            <div>
              <p className="text-zinc-400 mb-0.5">Consecutive failures</p>
              <span className={cn(
                'font-mono font-medium',
                subscription.failureCount > 0 ? 'text-amber-600' : 'text-zinc-700',
              )}>
                {subscription.failureCount}
              </span>
            </div>
            {lastDelivery && (
              <div>
                <p className="text-zinc-400 mb-0.5">Last delivery</p>
                <span className="text-zinc-700">{lastDelivery}</span>
              </div>
            )}
            {subscription.lastStatus !== undefined && subscription.lastStatus !== null && (
              <div>
                <p className="text-zinc-400 mb-0.5">Last HTTP status</p>
                <span className={cn(
                  'font-mono font-medium',
                  subscription.lastStatus >= 200 && subscription.lastStatus < 300
                    ? 'text-zinc-700'
                    : 'text-red-600',
                )}>
                  {subscription.lastStatus}
                </span>
              </div>
            )}
            {subscription.lastError && (
              <div className="col-span-2">
                <p className="text-zinc-400 mb-0.5">Last error</p>
                <span className="text-red-600 break-all">{subscription.lastError}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Danger actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rotate secret */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isRotating}
                >
                  {isRotating
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RotateCcw className="h-3.5 w-3.5" />}
                  Rotate secret
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="zoruui">
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate signing secret?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current secret will be invalidated immediately. Any receiver
                    still using the old secret will start failing signature checks.
                    The new secret is shown once — save it before dismissing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRotate}>
                    Rotate secret
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="zoruui">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the subscription. No further events
                    will be delivered to{' '}
                    <code className="text-xs">{subscription.url}</code>.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={onDelete}
                  >
                    Delete webhook
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                              */
/* -------------------------------------------------------------------------- */

export interface WebhookManagerProps {
  /** Explicit project scope; omit to use the user's first project. */
  projectId?: string;
  /** Optional CSS class applied to the outer container. */
  className?: string;
}

/**
 * A fully self-contained webhook subscription manager for the SabCRM API
 * settings page. Handles list, create, edit, rotate-secret, and delete.
 */
export function WebhookManager({ projectId, className }: WebhookManagerProps): React.ReactElement {
  const { toast } = useToast();

  /* ── Data state ── */
  const [subscriptions, setSubscriptions] = React.useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  /* ── Add/edit dialog ── */
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<WebhookSubscription | undefined>(undefined);

  /* ── Per-row async ops ── */
  const [rotatingId, setRotatingId] = React.useState<string | null>(null);

  /* ── Revealed secrets (id → cleartext secret, cleared on dismiss) ── */
  const [revealedSecrets, setRevealedSecrets] = React.useState<Record<string, string>>({});

  /* ─────────────────────────────────────────────────────────────────────────
   * Load subscriptions on mount (and on projectId change).
   * ─────────────────────────────────────────────────────────────────────── */
  const load = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    const result = await listWebhooksAction(projectId);
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setSubscriptions(result.data);
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Handlers
   * ─────────────────────────────────────────────────────────────────────── */

  function handleCreated(sub: WebhookSubscription): void {
    setSubscriptions((prev) => [sub, ...prev]);
    // Reveal the secret immediately in the new row's expanded detail.
    if (sub.secret) {
      setRevealedSecrets((prev) => ({ ...prev, [sub._id]: sub.secret! }));
    }
  }

  function handleUpdated(sub: WebhookSubscription): void {
    setSubscriptions((prev) => prev.map((s) => (s._id === sub._id ? sub : s)));
  }

  function openEdit(sub: WebhookSubscription): void {
    setEditTarget(sub);
    setFormOpen(true);
  }

  function openCreate(): void {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  async function handleRotate(id: string): Promise<void> {
    setRotatingId(id);
    const result = await rotateWebhookSecretAction(id, projectId);
    setRotatingId(null);
    if (!result.ok) {
      toast({ title: 'Failed to rotate secret', description: result.error, variant: 'destructive' });
      return;
    }
    setSubscriptions((prev) => prev.map((s) => (s._id === id ? result.data : s)));
    if (result.data.secret) {
      setRevealedSecrets((prev) => ({ ...prev, [id]: result.data.secret! }));
    }
    toast({ title: 'Secret rotated', description: 'Copy the new secret — it will not be shown again.' });
  }

  async function handleDelete(id: string): Promise<void> {
    const result = await deleteWebhookAction(id, projectId);
    if (!result.ok) {
      toast({ title: 'Failed to delete webhook', description: result.error, variant: 'destructive' });
      return;
    }
    setSubscriptions((prev) => prev.filter((s) => s._id !== id));
    setRevealedSecrets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast({ title: 'Webhook deleted' });
  }

  function dismissSecret(id: string): void {
    setRevealedSecrets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Render
   * ─────────────────────────────────────────────────────────────────────── */

  return (
    <div className={cn('zoruui space-y-4', className)}>
      {/* ── Card header ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4 text-zinc-500" />
              Webhook subscriptions
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              SabCRM POSTs a signed JSON payload to each active endpoint when a
              subscribed event fires. Payloads are signed with{' '}
              <code className="text-zinc-600">HMAC-SHA-256</code> and verified
              via the{' '}
              <code className="text-zinc-600">X-SabNode-Signature</code> header.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500"
                    onClick={() => { void load(); }}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add webhook
            </Button>
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <Separator className="mb-4" />

          {/* Loading skeleton */}
          {loading && <WebhookListSkeleton />}

          {/* Load error */}
          {!loading && loadError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Failed to load webhooks</p>
                <p className="text-xs text-red-500 mt-0.5">{loadError}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadError && subscriptions.length === 0 && (
            <EmptyState
              icon={<Webhook className="h-8 w-8 text-zinc-300" />}
              title="No webhooks yet"
              description="Add a webhook to receive real-time event notifications at an external HTTPS endpoint."
              action={
                <Button size="sm" className="gap-1.5" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Add webhook
                </Button>
              }
            />
          )}

          {/* Subscription list */}
          {!loading && !loadError && subscriptions.length > 0 && (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <SubscriptionRow
                  key={sub._id}
                  subscription={sub}
                  revealedSecret={revealedSecrets[sub._id] ?? null}
                  onSecretDismiss={() => dismissSecret(sub._id)}
                  onEdit={() => openEdit(sub)}
                  onRotate={() => { void handleRotate(sub._id); }}
                  onDelete={() => { void handleDelete(sub._id); }}
                  isRotating={rotatingId === sub._id}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Signing info callout ── */}
      {!loading && subscriptions.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          <ShieldCheck className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-zinc-700">Verifying signatures — </span>
            compute{' '}
            <code className="bg-zinc-100 px-1 rounded">HMAC-SHA-256(secret, rawBody)</code>{' '}
            and compare to the{' '}
            <code className="bg-zinc-100 px-1 rounded">X-SabNode-Signature: sha256=&lt;hex&gt;</code>{' '}
            header using a constant-time comparison to guard against timing attacks.
          </div>
        </div>
      )}

      {/* ── Add / edit dialog ── */}
      <WebhookFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        subscription={editTarget}
        projectId={projectId}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
