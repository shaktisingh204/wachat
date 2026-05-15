'use client';

/**
 * /sabwa/webhooks — Outbound webhook endpoints.
 *
 * Table of webhooks + "New webhook" Dialog. After create, a one-time
 * signing secret is displayed in a copy-able card. Clicking a row opens
 * a Sheet drawer with recent deliveries (resend + test actions).
 */

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

const STUB_PROJECT_ID = 'stub-project';

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
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (rate === undefined) return 'secondary';
  if (rate >= 0.95) return 'success';
  if (rate >= 0.7) return 'warning';
  return 'destructive';
}

export default function WebhooksPage() {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SabwaWebhookRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<SabwaWebhookRow | null>(null);
  const [pendingDelete, setPendingDelete] =
    React.useState<SabwaWebhookRow | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [secretReveal, setSecretReveal] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listWebhooks(STUB_PROJECT_ID);
      if (res.ok) setRows(res.webhooks);
    } catch {
      // engine offline
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleTest = React.useCallback(
    async (row: SabwaWebhookRow) => {
      try {
        const res = await testWebhook(row.id);
        if (!res.ok) {
          toast({
            title: 'Test failed',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Test event sent',
          description: `Endpoint responded ${res.statusCode} in ${res.latencyMs}ms.`,
        });
      } catch (err) {
        toast({
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
        toast({
          title: 'Could not delete',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Webhook deleted' });
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast({
        title: 'Could not reach engine',
        description: err instanceof Error ? err.message : 'Try again later.',
      });
      setPendingDelete(null);
    }
  }, [pendingDelete, toast, load]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-secondary p-3">
              <WebhookIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Webhooks
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
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
              className="h-9 gap-1.5"
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
                <Button size="sm" className="h-9 gap-1.5">
                  <Plus className="h-4 w-4" />
                  New webhook
                </Button>
              </DialogTrigger>
              <CreateWebhookDialogContent
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
          <CardHeader>
            <CardTitle className="text-base">Registered endpoints</CardTitle>
            <CardDescription>
              Click a row to inspect recent deliveries.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last delivery</TableHead>
                      <TableHead>Success rate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <TableCell className="max-w-[280px] truncate font-mono text-xs">
                          {maskUrl(row.url)}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={row.enabled ? 'success' : 'secondary'}
                          >
                            {row.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={successRateTone(row.successRate)}>
                            {row.successRate === undefined
                              ? '—'
                              : `${Math.round(row.successRate * 100)}%`}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => void handleTest(row)}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Send test event</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setPendingDelete(row)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
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
              <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
              <AlertDialogDescription>
                Pending deliveries will be dropped. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
  onCreated,
}: {
  onCreated: (signingSecret: string) => void | Promise<void>;
}) {
  const { toast } = useToast();
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
      toast({
        title: 'Missing fields',
        description: 'Provide an HTTPS URL and at least one event.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await upsertWebhook({
        projectId: STUB_PROJECT_ID,
        url: url.trim(),
        events,
        sessionId: sessionScope.trim() || undefined,
      });
      if (!res.ok) {
        toast({
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
      toast({
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
                className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm hover:bg-accent"
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
  const { toast } = useToast();
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Signing secret — copy now
        </CardTitle>
        <CardDescription>
          This secret is shown <strong>once</strong>. Use it to verify the HMAC
          signature on incoming requests. You won&apos;t be able to see it
          again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-background px-2.5 py-1.5 text-xs">
          {secret}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            toast({ title: 'Copied secret to clipboard' });
          }}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardContent>
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
  const { toast } = useToast();
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
      toast({ title: 'Resend queued', description: `Delivery ${id}` });
    } catch (err) {
      toast({
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
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                  className="rounded-md border bg-card p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {d.statusCode && d.statusCode >= 200 && d.statusCode < 300 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
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
                      className="h-7 text-[11px]"
                      onClick={() => void resend(d.id)}
                    >
                      Resend
                    </Button>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {d.event} ·{' '}
                    {formatDistanceToNow(new Date(d.ts), { addSuffix: true })}
                  </div>
                  {d.responseExcerpt ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted/40 p-2 text-[11px]">
                      {d.responseExcerpt}
                    </pre>
                  ) : null}
                  {d.error ? (
                    <p className="mt-1 text-destructive">{d.error}</p>
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
