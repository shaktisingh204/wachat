'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Table, TBody, Td, Th, THead, Tr, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import {
  format,
  formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
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
 * Visual layer migrated to Ui20.
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
  const toast = useToast();
  const { activeProjectId } = useProject();
  const [rows, setRows] = React.useState<SabwaWebhookRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<SabwaWebhookRow | null>(null);
  const [pendingDelete, setPendingDelete] =
    React.useState<SabwaWebhookRow | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [secretReveal, setSecretReveal] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [eventFilter, setEventFilter] = React.useState('all');

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

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.url.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'enabled' && !r.enabled) return false;
        if (statusFilter === 'disabled' && r.enabled) return false;
      }
      if (eventFilter !== 'all') {
        if (!r.events.includes(eventFilter as SabwaWebhookEvent)) return false;
      }
      return true;
    });
  }, [rows, searchQuery, statusFilter, eventFilter]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">
                SabNode
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Webhooks</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <WebhookIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-[var(--st-text)]">
                Webhooks
              </h1>
              <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
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
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  New webhook
                </Button>
              </DialogTrigger>
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 sm:max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
              <Input
                placeholder="Search webhooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1">
              <Filter className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <span className="text-xs text-[var(--st-text-secondary)]">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-[120px] border-none bg-transparent px-2 py-0 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1">
              <Filter className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <span className="text-xs text-[var(--st-text-secondary)]">Event</span>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="h-7 w-[160px] border-none bg-transparent px-2 py-0 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {ALL_EVENTS.map((ev) => (
                    <SelectItem key={ev.value} value={ev.value}>
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Registered endpoints
            </CardTitle>
            <CardDescription>
              Click a row to inspect recent deliveries.
            </CardDescription>
          </CardHeader>
          <CardBody>
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
            ) : filteredRows.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No results found"
                description="Adjust your filters to see more results."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setEventFilter('all');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>URL</Th>
                      <Th>Events</Th>
                      <Th>Status</Th>
                      <Th>Last delivery</Th>
                      <Th>Success rate</Th>
                      <Th className="text-right">
                        Actions
                      </Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {filteredRows.map((row) => (
                      <Tr
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <Td className="max-w-[280px] truncate font-mono text-xs">
                          {maskUrl(row.url)}
                        </Td>
                        <Td>
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
                        </Td>
                        <Td>
                          <Badge
                            variant={row.enabled ? 'success' : 'secondary'}
                          >
                            {row.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </Td>
                        <Td>
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
                            <span className="text-[var(--st-text-secondary)]">—</span>
                          )}
                        </Td>
                        <Td>
                          <Badge variant={successRateTone(row.successRate)}>
                            {row.successRate === undefined
                              ? '—'
                              : `${Math.round(row.successRate * 100)}%`}
                          </Badge>
                        </Td>
                        <Td
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => void handleTest(row)}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Send test event
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-[var(--st-danger)] hover:text-[var(--st-danger)]"
                                  onClick={() => setPendingDelete(row)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>

        <DeliveriesSheet
          webhook={selected}
          onClose={() => setSelected(null)}
        />

        <AlertDialog
          open={pendingDelete !== null}
          onOpenChange={(o) => !o && setPendingDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete this webhook?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Pending deliveries will be dropped. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleDelete()}
                className="bg-[var(--st-danger)] text-[var(--st-text-inverted)] hover:bg-[var(--st-danger)]/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
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
  const toast = useToast();
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
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>New webhook</DialogTitle>
        <DialogDescription>
          Register an HTTPS endpoint and choose which events to fan out.
        </DialogDescription>
      </DialogHeader>
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
                className="flex cursor-pointer items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]"
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
      <DialogFooter>
        <Button onClick={() => void submit()} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : null}
          Create webhook
        </Button>
      </DialogFooter>
    </DialogContent>
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
  const toast = useToast();
  return (
    <Card className="border-[var(--st-warn)]/40 bg-[var(--st-warn)]/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[var(--st-text)]">
          <AlertTriangle className="h-4 w-4 text-[var(--st-warn)]" />
          Signing secret — copy now
        </CardTitle>
        <CardDescription>
          This secret is shown <strong>once</strong>. Use it to verify the HMAC
          signature on incoming requests. You won&apos;t be able to see it
          again.
        </CardDescription>
      </CardHeader>
      <CardBody className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-xs text-[var(--st-text)]">
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
      </CardBody>
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
  const toast = useToast();
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
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Recent deliveries</SheetTitle>
          <SheetDescription className="truncate font-mono text-xs">
            {webhook ? maskUrl(webhook.url) : ''}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
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
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 text-xs text-[var(--st-text)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {d.statusCode &&
                      d.statusCode >= 200 &&
                      d.statusCode < 300 ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[var(--st-danger)]" />
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
                  <div className="mt-1 text-[var(--st-text-secondary)]">
                    {d.event} ·{' '}
                    {formatDistanceToNow(new Date(d.ts), { addSuffix: true })}
                  </div>
                  {d.responseExcerpt ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] p-2 text-[11px]">
                      {d.responseExcerpt}
                    </pre>
                  ) : null}
                  {d.error ? (
                    <p className="mt-1 text-[var(--st-danger)]">{d.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
