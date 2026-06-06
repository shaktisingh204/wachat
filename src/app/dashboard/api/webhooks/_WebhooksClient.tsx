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
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Field,
  Input,
  Textarea,
  Alert,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
  Badge,
  EmptyState,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { Copy, Webhook, RefreshCw } from 'lucide-react';

interface Props {
  initialSubs: WebhookSubscription[];
  initialDeliveries: WebhookDelivery[];
}

const SUB_STATUS_TONE: Record<string, BadgeTone> = {
  active: 'success',
  paused: 'warning',
};

export function WebhooksClient({ initialSubs, initialDeliveries }: Props): JSX.Element {
  const { toast } = useToast();
  const [subs, setSubs] = useState<WebhookSubscription[]>(initialSubs);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>(initialDeliveries);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState('contact.created\nwachat.message.sent');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  const reloadDeliveries = useCallback((): void => {
    startBusy(async () => {
      const res = await listWebhookDeliveries(selectedSubId ?? undefined, 50);
      if (res.success) setDeliveries(res.deliveries);
    });
  }, [selectedSubId]);

  useEffect(() => {
    setMounted(true);
    reloadDeliveries();
  }, [reloadDeliveries]);

  const handleCreate = (): void => {
    if (!url.trim()) return;
    const eventList = events.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
    startBusy(async () => {
      const res = await createWebhookSubscription({ url: url.trim(), events: eventList });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSubs((prev) => [res.sub, ...prev]);
      setSecret(res.secret);
      setUrl('');
      toast.success('Subscription created.');
    });
  };

  const handleDelete = (id: string): void => {
    if (!confirm('Delete this subscription? Pending deliveries will be cancelled.')) return;
    startBusy(async () => {
      const res = await deleteWebhookSubscription(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSubs((prev) => prev.filter((s) => s._id !== id));
      toast.success('Subscription deleted.');
    });
  };

  const handleTest = (id: string): void => {
    startBusy(async () => {
      const res = await testWebhookSubscription(id);
      if (!res.success) toast.error(res.error);
      else {
        reloadDeliveries();
        toast.success('Test event queued.');
      }
    });
  };

  const handleRetry = (id: string): void => {
    startBusy(async () => {
      const res = await retryWebhookDelivery(id);
      if (!res.success) toast.error(res.error);
      else {
        reloadDeliveries();
        toast.success('Delivery re-queued.');
      }
    });
  };

  const copySecret = (value: string): void => {
    void navigator.clipboard.writeText(value);
    toast.success('Signing secret copied.');
  };

  return (
    <div className="space-y-6">
      {secret ? (
        <Alert tone="warning" title="Save this signing secret. It is shown once.">
          <div className="space-y-2">
            <p className="text-xs text-[var(--st-text-secondary)]">
              Use it to verify the{' '}
              <code className="font-mono">X-SabNode-Signature</code> header on every delivery.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--st-text)]">
                {secret}
              </code>
              <Button size="sm" variant="outline" iconLeft={Copy} onClick={() => copySecret(secret)}>
                Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--st-text)]">Subscriptions</h2>

        <Card>
          <CardHeader>
            <CardTitle>Create subscription</CardTitle>
            <CardDescription>Enter your endpoint URL and the events you want to receive.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Endpoint URL">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourapp.com/webhooks/sabnode"
                disabled={busy}
              />
            </Field>
            <Field label="Events" help="One event name per line. Use * to subscribe to everything.">
              <Textarea
                value={events}
                onChange={(e) => setEvents(e.target.value)}
                rows={3}
                placeholder="event.name"
                className="font-mono text-xs"
                disabled={busy}
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleCreate} loading={busy} disabled={busy || !url.trim()}>
                Create
              </Button>
            </div>
          </CardBody>
        </Card>

        {subs.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No subscriptions yet"
            description="Create a subscription above to start receiving events."
          />
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <Card
                key={s._id}
                className={selectedSubId === s._id ? 'border-[var(--st-border-strong)] ring-1 ring-[var(--st-border-strong)]' : ''}
              >
                <CardBody className="pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-[var(--st-text)]">{s.url}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--st-text-secondary)]">
                        Events: <span className="font-mono">{s.events.join(' ') || '(none)'}</span>
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Badge tone={SUB_STATUS_TONE[s.status] ?? 'danger'}>{s.status}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSubId((prev) => (prev === s._id ? null : s._id))}
                      >
                        {selectedSubId === s._id ? 'Hide' : 'Filter'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTest(s._id)} disabled={busy}>
                        Test
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(s._id)} disabled={busy}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--st-text)]">Recent deliveries</h2>
          <Button variant="ghost" size="sm" iconLeft={RefreshCw} onClick={reloadDeliveries} disabled={busy}>
            Refresh
          </Button>
        </div>

        <Card padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>HTTP</Th>
                <Th>When</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {deliveries.length === 0 ? (
                <Tr>
                  <Td colSpan={6} align="center" className="py-6 text-xs text-[var(--st-text-secondary)]">
                    No deliveries yet. Click Test on a subscription to fire a synthetic event.
                  </Td>
                </Tr>
              ) : null}
              {deliveries.map((d) => (
                <Tr key={d._id}>
                  <Td className="font-mono text-xs text-[var(--st-text)]">{d.event}</Td>
                  <Td>
                    {d.status === 'success' ? (
                      <Badge tone="success" kind="soft">success</Badge>
                    ) : d.status === 'failed' ? (
                      <Badge tone="danger" kind="soft">failed</Badge>
                    ) : (
                      <Badge tone="neutral" kind="soft">{d.status}</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">{d.attempts}</Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">{d.responseStatus ?? '-'}</Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">
                    {mounted ? new Date(d.createdAt).toLocaleString() : '-'}
                  </Td>
                  <Td align="right">
                    {d.status === 'failed' ? (
                      <Button variant="ghost" size="sm" onClick={() => handleRetry(d._id)} disabled={busy}>
                        Retry
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
