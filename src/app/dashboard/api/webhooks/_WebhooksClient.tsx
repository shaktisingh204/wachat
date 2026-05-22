'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  testWebhookSubscription,
  listWebhookDeliveries,
  retryWebhookDelivery,
  type WebhookSubscription,
  type WebhookDelivery,
} from '@/app/actions/developer-platform.actions';
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Input,
  Textarea,
  Alert,
  ZoruAlertDescription,
  Table,
  ZoruTableHeader,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableCell,
  Badge,
  EmptyState,
} from '@/components/zoruui';
import { AlertCircle, TriangleAlert, Copy, Webhook, RefreshCw } from 'lucide-react';

interface Props {
  initialSubs: WebhookSubscription[];
  initialDeliveries: WebhookDelivery[];
}

export function WebhooksClient({ initialSubs, initialDeliveries }: Props): JSX.Element {
  const [subs, setSubs] = useState<WebhookSubscription[]>(initialSubs);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(initialDeliveries);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('contact.created\nwachat.message.sent');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const reloadDeliveries = useCallback((): void => {
    startBusy(async () => {
      const res = await listWebhookDeliveries(selectedSubId ?? undefined, 50);
      if (res.success) setDeliveries(res.deliveries);
    });
  }, [selectedSubId]);

  useEffect(() => {
    reloadDeliveries();
  }, [reloadDeliveries]);

  const handleCreate = (): void => {
    if (!url.trim()) return;
    setError(null);
    const eventList = events.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    startBusy(async () => {
      const res = await createWebhookSubscription({ url: url.trim(), events: eventList });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSubs((prev) => [res.sub, ...prev]);
      setSecret(res.secret);
      setUrl('');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this subscription? Pending deliveries will be cancelled.')) return;
    startBusy(async () => {
      const res = await deleteWebhookSubscription(id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSubs((prev) => prev.filter((s) => s._id !== id));
    });
  };

  const handleTest = (id: string): void => {
    startBusy(async () => {
      const res = await testWebhookSubscription(id);
      if (!res.success) setError(res.error);
      else reloadDeliveries();
    });
  };

  const handleRetry = (id: string): void => {
    startBusy(async () => {
      const res = await retryWebhookDelivery(id);
      if (!res.success) setError(res.error);
      else reloadDeliveries();
    });
  };

  return (
    <div className="space-y-6">
      {secret ? (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <div className="space-y-2">
            <p className="font-semibold text-sm">Save this signing secret — shown once.</p>
            <p className="text-xs">Use it to verify the <code className="font-mono">X-SabNode-Signature</code> header on every delivery.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-zoru-surface border border-zoru-line rounded px-3 py-2 text-zoru-ink overflow-x-auto">
                {secret}
              </code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(secret)}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zoru-ink">Subscriptions</h2>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Create subscription</ZoruCardTitle>
            <ZoruCardDescription>Enter your endpoint URL and the events you want to receive.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourapp.com/webhooks/sabnode"
              disabled={busy}
            />
            <Textarea
              value={events}
              onChange={(e) => setEvents(e.target.value)}
              rows={3}
              placeholder="event.name (one per line, * to subscribe to everything)"
              className="font-mono text-xs"
              disabled={busy}
            />
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={busy || !url.trim()}>
                {busy ? 'Working…' : 'Create'}
              </Button>
            </div>
          </ZoruCardContent>
        </Card>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        ) : null}

        {subs.length === 0 ? (
          <EmptyState
            icon={<Webhook className="h-8 w-8" />}
            title="No subscriptions yet"
            description="Create a subscription above to start receiving events."
          />
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <Card
                key={s._id}
                className={selectedSubId === s._id ? 'border-zoru-line-strong ring-1 ring-zoru-line-strong' : ''}
              >
                <ZoruCardContent className="pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-zoru-ink truncate">{s.url}</p>
                      <p className="text-xs text-zoru-ink-muted mt-0.5 truncate">
                        Events: <span className="font-mono">{s.events.join(' ') || '(none)'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        className={
                          s.status === 'active'
                            ? 'bg-green-600 text-white'
                            : s.status === 'paused'
                              ? 'bg-yellow-500 text-black'
                              : 'bg-red-600 text-white'
                        }
                      >
                        {s.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSubId((prev) => (prev === s._id ? null : s._id))}
                      >
                        {selectedSubId === s._id ? 'Hide' : 'Filter'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(s._id)}
                        disabled={busy}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(s._id)}
                        disabled={busy}
                        className="text-zoru-danger hover:text-zoru-danger"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </ZoruCardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zoru-ink">Recent deliveries</h2>
          <Button variant="ghost" size="sm" onClick={reloadDeliveries} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        <Card>
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Event</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Attempts</ZoruTableHead>
                <ZoruTableHead>HTTP</ZoruTableHead>
                <ZoruTableHead>When</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {deliveries.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={6} className="text-center text-zoru-ink-muted py-6 text-xs">
                    No deliveries yet. Click <em>Test</em> on a subscription to fire a synthetic event.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : null}
              {deliveries.map((d) => (
                <ZoruTableRow key={d._id}>
                  <ZoruTableCell className="font-mono text-zoru-ink text-xs">{d.event}</ZoruTableCell>
                  <ZoruTableCell>
                    <span
                      className={
                        d.status === 'success'
                          ? 'text-zoru-success text-xs'
                          : d.status === 'failed'
                            ? 'text-zoru-danger text-xs'
                            : 'text-zoru-ink-muted text-xs'
                      }
                    >
                      {d.status}
                    </span>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-xs text-zoru-ink-muted">{d.attempts}</ZoruTableCell>
                  <ZoruTableCell className="text-xs text-zoru-ink-muted">{d.responseStatus ?? '—'}</ZoruTableCell>
                  <ZoruTableCell className="text-xs text-zoru-ink-muted">{new Date(d.createdAt).toLocaleString()}</ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    {d.status === 'failed' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(d._id)}
                        disabled={busy}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
