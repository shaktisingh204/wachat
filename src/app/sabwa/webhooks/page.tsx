'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  format,
  formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook as WebhookIcon,
  XCircle,
  } from 'lucide-react';

import {
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  testWebhook,
  upsertWebhook,
  type SabwaWebhookDelivery,
  type SabwaWebhookRow,
  } from '@/app/actions/sabwa.actions';
import type { SabwaWebhookEvent } from '@/lib/sabwa/types';

/**
 * /sabwa/webhooks — Outbound webhook endpoints.
 *
 * Table of webhooks + "New webhook" Dialog. After create, a one-time
 * signing secret is displayed in a copy-able card. Clicking a row opens
 * a Sheet drawer with recent deliveries (resend + test actions).
 *
 * Visual layer migrated to ZoruUI.
 */

import * as React from 'react';

import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { useProject } from '@/context/project-context';

const ALL_EVENTS: { value: SabwaWebhookEvent; label: string }[] = [
  { value: 'message.received', label: 'Message received' },
  { value: 'message.status', label: 'Message status' },
  { value: 'chat.updated', label: 'Chat updated' },
  { value: 'group.joined', label: 'Group joined' },
  { value: 'group.left', label: 'Group left' },
  { value: 'session.connected', label: 'Session connected' },
  { value: 'session.disconnected', label: 'Session disconnected' },
  { value: 'scheduled.fired', label: 'Scheduled fired' },
];

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 18 ? `${u.pathname.slice(0, 16)}…` : u.pathname;
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return url;
  }
}

function successRateTone(
  rate?: number,
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (rate === undefined) return 'secondary';
  if (rate >= 0.95) return 'success';
  if (rate >= 0.7) return 'warning';
  return 'danger';
}

export default function WebhooksPage() {
  const toast = useZoruToast();
  const { activeProjectId } = useProject();
  const [rows, setRows] = React.useState<SabwaWebhookRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<SabwaWebhookRow | null>(null);
  const [pendingDelete, setPendingDelete] =
    React.useState<SabwaWebhookRow | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [secretReveal, setSecretReveal] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!activeProjectId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listWebhooks(activeProjectId);
      if (res.ok) setRows(res.webhooks);
    } catch {
      // engine offline
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleTest = React.useCallback(
    async (row: SabwaWebhookRow) => {
      try {
        const res = await testWebhook(row.id);
        if (!res.ok) {
          toast.toast({
            title: 'Test failed',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        toast.toast({
          title: 'Test event sent',
          description: `Endpoint responded ${res.statusCode} in ${res.latencyMs}ms.`,
        });
      } catch (err) {
        toast.toast({
          title: 'Could not reach engine',
          description:
            err instanceof Error ? err.message : 'Try again once it is online.',
        });
      }
    },
    [toast],
  );

  const handleDelete = React.useCallback(async () => {
    if (!pendingDelete) return;
    try {
      const res = await deleteWebhook(pendingDelete.id);
      if (!res.ok) {
        toast.toast({
          title: 'Could not delete',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast.toast({ title: 'Webhook deleted' });
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
      setPendingDelete(null);
    }
  }, [pendingDelete, toast, load]);

  return (
    <ZoruTooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
        <Breadcrumb>
          <ZoruBreadcrumbList>
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/dashboard">
                SabNode
              </ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
            </ZoruBreadcrumbItem>
            <ZoruBreadcrumbSeparator />
            <ZoruBreadcrumbItem>
              <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink">
              <WebhookIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-zoru-ink">
                Webhooks
              </h1>
              <p className="mt-1 text-[13px] text-zoru-ink-muted">
                Stream SabWa events to your own systems over HTTPS with HMAC
                signing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <ZoruDialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  New webhook
                </Button>
              </ZoruDialogTrigger>
              <CreateWebhookDialogContent
                projectId={activeProjectId}
                onCreated={async (secret) => {
                  setCreateOpen(false);
                  setSecretReveal(secret);
                  await load();
                }}
              />
            </Dialog>
          </div>
        </div>

        {secretReveal ? (
          <SecretRevealCard
            secret={secretReveal}
            onDismiss={() => setSecretReveal(null)}
          />
        ) : null}

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-base">
              Registered endpoints
            </ZoruCardTitle>
            <ZoruCardDescription>
              Click a row to inspect recent deliveries.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {rows.length === 0 ? (
              <EmptyState
                icon={WebhookIcon}
                title="No webhooks yet"
                description="Register an HTTPS endpoint to start receiving SabWa events."
                action={
                  <Button
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    New webhook
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow>
                      <ZoruTableHead>URL</ZoruTableHead>
                      <ZoruTableHead>Events</ZoruTableHead>
                      <ZoruTableHead>Status</ZoruTableHead>
                      <ZoruTableHead>Last delivery</ZoruTableHead>
                      <ZoruTableHead>Success rate</ZoruTableHead>
                      <ZoruTableHead className="text-right">
                        Actions
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {rows.map((row) => (
                      <ZoruTableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <ZoruTableCell className="max-w-[280px] truncate font-mono text-xs">
                          {maskUrl(row.url)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {row.events.slice(0, 3).map((ev) => (
                              <Badge
                                key={ev}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {ev}
                              </Badge>
                            ))}
                            {row.events.length > 3 ? (
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                              >
                                +{row.events.length - 3}
                              </Badge>
                            ) : null}
                          </div>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge
                            variant={row.enabled ? 'success' : 'secondary'}
                          >
                            {row.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {row.lastDeliveryAt ? (
                            <span
                              title={format(
                                new Date(row.lastDeliveryAt),
                                'PPpp',
                              )}
                            >
                              {formatDistanceToNow(
                                new Date(row.lastDeliveryAt),
                                { addSuffix: true },
                              )}
                              {typeof row.lastDeliveryStatus === 'number'
                                ? ` · ${row.lastDeliveryStatus}`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge variant={successRateTone(row.successRate)}>
                            {row.successRate === undefined
                              ? '—'
                              : `${Math.round(row.successRate * 100)}%`}
                          </Badge>
                        </ZoruTableCell>
                        <ZoruTableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <ZoruTooltipTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => void handleTest(row)}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </ZoruTooltipTrigger>
                              <ZoruTooltipContent>
                                Send test event
                              </ZoruTooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <ZoruTooltipTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-zoru-danger hover:text-zoru-danger"
                                  onClick={() => setPendingDelete(row)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </ZoruTooltipTrigger>
                              <ZoruTooltipContent>Delete</ZoruTooltipContent>
                            </Tooltip>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))}
                  </ZoruTableBody>
                </Table>
              </div>
            )}
          </ZoruCardContent>
        </Card>

        <DeliveriesSheet
          webhook={selected}
          onClose={() => setSelected(null)}
        />

        <ZoruAlertDialog
          open={pendingDelete !== null}
          onOpenChange={(o) => !o && setPendingDelete(null)}
        >
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>
                Delete this webhook?
              </ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                Pending deliveries will be dropped. This action cannot be
                undone.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction
                onClick={() => void handleDelete()}
                className="bg-zoru-danger text-zoru-danger-foreground hover:bg-zoru-danger/90"
              >
                Delete
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>
      </div>
    </ZoruTooltipProvider>
  );
}

// ─── New webhook dialog ────────────────────────────────────────────────────

function CreateWebhookDialogContent({
  projectId,
  onCreated,
}: {
  projectId: string | null;
  onCreated: (signingSecret: string) => void | Promise<void>;
}) {
  const toast = useZoruToast();
  const [url, setUrl] = React.useState('');
  const [sessionScope, setSessionScope] = React.useState('');
  const [events, setEvents] = React.useState<SabwaWebhookEvent[]>([
    'message.received',
    'message.status',
  ]);
  const [submitting, setSubmitting] = React.useState(false);

  const toggle = (ev: SabwaWebhookEvent) =>
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );

  const submit = async () => {
    if (!url.trim() || events.length === 0) {
      toast.toast({
        title: 'Missing fields',
        description: 'Provide an HTTPS URL and at least one event.',
        variant: 'destructive',
      });
      return;
    }
    if (!projectId) {
      toast.toast({
        title: 'No active project',
        description: 'Select a project before creating a webhook.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await upsertWebhook({
        projectId,
        url: url.trim(),
        events,
        sessionId: sessionScope.trim() || undefined,
      });
      if (!res.ok) {
        toast.toast({
          title: 'Could not create webhook',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      await onCreated(
        res.signingSecret ?? '(secret will appear once the engine is online)',
      );
    } catch (err) {
      toast.toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ZoruDialogContent className="sm:max-w-[520px]">
      <ZoruDialogHeader>
        <ZoruDialogTitle>New webhook</ZoruDialogTitle>
        <ZoruDialogDescription>
          Register an HTTPS endpoint and choose which events to fan out.
        </ZoruDialogDescription>
      </ZoruDialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wh-url">Endpoint URL</Label>
          <Input
            id="wh-url"
            placeholder="https://example.com/sabwa/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wh-scope">Session scope (optional)</Label>
          <Input
            id="wh-scope"
            placeholder="Leave blank for all sessions"
            value={sessionScope}
            onChange={(e) => setSessionScope(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Events</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_EVENTS.map((ev) => (
              <Label
                key={ev.value}
                htmlFor={`wh-ev-${ev.value}`}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-sm text-zoru-ink hover:bg-zoru-surface"
              >
                <Checkbox
                  id={`wh-ev-${ev.value}`}
                  checked={events.includes(ev.value)}
                  onCheckedChange={() => toggle(ev.value)}
                />
                <span className="text-xs">{ev.label}</span>
              </Label>
            ))}
          </div>
        </div>
      </div>
      <ZoruDialogFooter>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          Create webhook
        </Button>
      </ZoruDialogFooter>
    </ZoruDialogContent>
  );
}

// ─── One-time secret reveal ────────────────────────────────────────────────

function SecretRevealCard({
  secret,
  onDismiss,
}: {
  secret: string;
  onDismiss: () => void;
}) {
  const toast = useZoruToast();
  return (
    <Card className="border-zoru-warning/40 bg-zoru-warning/5">
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2 text-base text-zoru-ink">
          <AlertTriangle className="h-4 w-4 text-zoru-warning-ink" />
          Signing secret — copy now
        </ZoruCardTitle>
        <ZoruCardDescription>
          This secret is shown <strong>once</strong>. Use it to verify the HMAC
          signature on incoming requests. You won&apos;t be able to see it
          again.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-xs text-zoru-ink">
          {secret}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            toast.toast({ title: 'Copied secret to clipboard' });
          }}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </ZoruCardContent>
    </Card>
  );
}

// ─── Delivery drawer ───────────────────────────────────────────────────────

function DeliveriesSheet({
  webhook,
  onClose,
}: {
  webhook: SabwaWebhookRow | null;
  onClose: () => void;
}) {
  const toast = useZoruToast();
  const [deliveries, setDeliveries] = React.useState<SabwaWebhookDelivery[]>(
    [],
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!webhook) {
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listWebhookDeliveries({ webhookId: webhook.id, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setDeliveries(res.deliveries);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [webhook]);

  const resend = async (id: string) => {
    try {
      await testWebhook(webhook!.id);
      toast.toast({ title: 'Resend queued', description: `Delivery ${id}` });
    } catch (err) {
      toast.toast({
        title: 'Could not resend',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={webhook !== null} onOpenChange={(o) => !o && onClose()}>
      <ZoruSheetContent className="w-full sm:max-w-xl">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Recent deliveries</ZoruSheetTitle>
          <ZoruSheetDescription className="truncate font-mono text-xs">
            {webhook ? maskUrl(webhook.url) : ''}
          </ZoruSheetDescription>
        </ZoruSheetHeader>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
            </div>
          ) : deliveries.length === 0 ? (
            <EmptyState
              icon={WebhookIcon}
              title="No deliveries yet"
              description="Deliveries will appear once events fire for this endpoint."
            />
          ) : (
            <ul className="space-y-2">
              {deliveries.map((d) => (
                <li
                  key={d.id}
                  className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3 text-xs text-zoru-ink"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {d.statusCode &&
                      d.statusCode >= 200 &&
                      d.statusCode < 300 ? (
                        <CheckCircle2 className="h-4 w-4 text-zoru-success-ink" />
                      ) : (
                        <XCircle className="h-4 w-4 text-zoru-danger-ink" />
                      )}
                      <span className="font-mono">
                        {d.statusCode ?? '—'} · {d.latencyMs ?? '—'}ms
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        attempt {d.attempt}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void resend(d.id)}
                    >
                      Resend
                    </Button>
                  </div>
                  <div className="mt-1 text-zoru-ink-muted">
                    {d.event} ·{' '}
                    {formatDistanceToNow(new Date(d.ts), { addSuffix: true })}
                  </div>
                  {d.responseExcerpt ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded-[var(--zoru-radius-sm)] bg-zoru-surface p-2 text-[11px]">
                      {d.responseExcerpt}
                    </pre>
                  ) : null}
                  {d.error ? (
                    <p className="mt-1 text-zoru-danger-ink">{d.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </ZoruSheetContent>
    </Sheet>
  );
}
