'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Modal,
  SelectField,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import {
  SABPAY_WEBHOOK_EVENTS,
  isSabpayWebhookEvent,
  type SabpayWebhookDelivery,
  type SabpayWebhookEndpoint,
  type SabpayWebhookEvent,
} from '@/lib/sabpay/types';

import {
  createSabpayWebhook,
  deleteSabpayWebhook,
  rotateSabpayWebhookSecret,
  updateSabpayWebhook,
  type SabpayWebhookData,
} from '../actions';
import {
  getSabpayWebhookDeliveries,
  redeliverSabpayWebhook,
} from '../actions/webhooks-extra';
import { ConfirmAction } from '../_components/confirm-action';

/* ── Event catalog, grouped by entity prefix ─────────────────────────────── */

const EVENT_GROUP_LABELS: Record<string, string> = {
  payment: 'Payments',
  order: 'Orders',
  refund: 'Refunds',
  payment_link: 'Payment links',
  invoice: 'Invoices',
  subscription: 'Subscriptions',
  qr_code: 'QR codes',
  settlement: 'Settlements',
  dispute: 'Disputes',
};

interface EventGroup {
  prefix: string;
  label: string;
  events: SabpayWebhookEvent[];
}

/** `payment.*`, `order.*`, … in catalog order. */
const EVENT_GROUPS: EventGroup[] = (() => {
  const byPrefix = new Map<string, SabpayWebhookEvent[]>();
  for (const event of SABPAY_WEBHOOK_EVENTS) {
    const prefix = event.slice(0, event.indexOf('.'));
    const bucket = byPrefix.get(prefix);
    if (bucket) bucket.push(event);
    else byPrefix.set(prefix, [event]);
  }
  return [...byPrefix].map(([prefix, events]) => ({
    prefix,
    label: EVENT_GROUP_LABELS[prefix] ?? prefix,
    events,
  }));
})();

const EVENT_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All events' },
  ...SABPAY_WEBHOOK_EVENTS.map((event) => ({ value: event, label: event })),
];

function SecretReveal({ secret }: { secret: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--st-border)',
        background: 'var(--st-bg)',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--st-font-mono, monospace)',
          fontSize: 12.5,
          overflowWrap: 'anywhere',
        }}
      >
        {secret}
      </code>
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
        aria-label="Copy signing secret"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export function WebhooksClient({ initialData }: { initialData: SabpayWebhookData }) {
  const router = useRouter();
  const { endpoints, deliveries } = initialData;

  const [createOpen, setCreateOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState<SabpayWebhookEvent[]>([
    'payment.succeeded',
    'payment.failed',
  ]);
  const [description, setDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);

  const [rotateTarget, setRotateTarget] = React.useState<SabpayWebhookEndpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SabpayWebhookEndpoint | null>(null);

  // Delivery-log filter. `filtered` is null while the unfiltered server-fed
  // list is shown; `filterVersion` bumps to refetch after a redelivery.
  const [eventFilter, setEventFilter] = React.useState<SabpayWebhookEvent | 'all'>('all');
  const [endpointFilter, setEndpointFilter] = React.useState<string>('all');
  const [filtered, setFiltered] = React.useState<SabpayWebhookDelivery[] | null>(null);
  const [filterLoading, setFilterLoading] = React.useState(false);
  const [filterVersion, setFilterVersion] = React.useState(0);
  const [redelivering, setRedelivering] = React.useState<string | null>(null);

  const filtersActive = eventFilter !== 'all' || endpointFilter !== 'all';

  React.useEffect(() => {
    if (eventFilter === 'all' && endpointFilter === 'all') {
      setFiltered(null);
      setFilterLoading(false);
      return;
    }
    let cancelled = false;
    setFilterLoading(true);
    getSabpayWebhookDeliveries({
      event: eventFilter === 'all' ? undefined : eventFilter,
      endpointId: endpointFilter === 'all' ? undefined : endpointFilter,
      limit: 50,
    })
      .then((rows) => {
        if (!cancelled) setFiltered(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load the filtered deliveries.');
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventFilter, endpointFilter, filterVersion]);

  const shownDeliveries = filtered ?? deliveries;

  function toggleEvent(event: SabpayWebhookEvent, on: boolean) {
    setEvents((prev) =>
      on ? [...new Set([...prev, event])] : prev.filter((e) => e !== event),
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const result = await createSabpayWebhook({
      url,
      events,
      description: description || undefined,
    });
    setSaving(false);
    if (result.error || !result.endpoint?.secret) {
      setFormError(result.error || 'Could not create the endpoint.');
      return;
    }
    setRevealedSecret(result.endpoint.secret);
    setUrl('');
    setDescription('');
    router.refresh();
  }

  async function handleToggleActive(endpoint: SabpayWebhookEndpoint, active: boolean) {
    const result = await updateSabpayWebhook(endpoint._id, { active });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast({ title: active ? 'Endpoint enabled' : 'Endpoint disabled', tone: 'success' });
    router.refresh();
  }

  async function handleRotate(endpoint: SabpayWebhookEndpoint) {
    const result = await rotateSabpayWebhookSecret(endpoint._id);
    if (result.error || !result.endpoint?.secret) {
      toast.error(result.error || 'Could not rotate the secret.');
      return;
    }
    setRevealedSecret(result.endpoint.secret);
    setCreateOpen(true);
    router.refresh();
  }

  async function handleDelete(endpoint: SabpayWebhookEndpoint) {
    const result = await deleteSabpayWebhook(endpoint._id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast({ title: 'Endpoint deleted', tone: 'success' });
    router.refresh();
  }

  async function handleRedeliver(delivery: SabpayWebhookDelivery) {
    setRedelivering(delivery._id);
    const result = await redeliverSabpayWebhook(delivery._id);
    setRedelivering(null);
    if (result.error || !result.delivery) {
      toast.error(result.error || 'Could not redeliver the event.');
      return;
    }
    toast({
      title: result.delivery.success ? 'Event redelivered' : 'Redelivery attempted',
      description: result.delivery.success
        ? `${delivery.event} was accepted with HTTP ${result.delivery.status}.`
        : `The endpoint answered ${
            result.delivery.status ? `HTTP ${result.delivery.status}` : 'no response'
          } — see the new log row.`,
      tone: result.delivery.success ? 'success' : 'warning',
    });
    if (filtersActive) setFilterVersion((v) => v + 1);
    router.refresh();
  }

  function closeModal() {
    setCreateOpen(false);
    setRevealedSecret(null);
    setFormError(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>
              Each endpoint gets its own whsec_ secret; verify the
              X-SabNode-Signature header on every delivery.
            </CardDescription>
          </div>
          <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
            Add endpoint
          </Button>
        </CardHeader>
        <CardBody>
          {endpoints.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No endpoints yet. Add one and we'll start delivering payment
              events to it.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>URL</Th>
                  <Th>Events</Th>
                  <Th>Last delivery</Th>
                  <Th>Active</Th>
                  <Th aria-label="Actions" />
                </Tr>
              </THead>
              <TBody>
                {endpoints.map((endpoint) => (
                  <Tr key={endpoint._id}>
                    <Td style={{ maxWidth: 320 }}>
                      <span
                        style={{
                          fontFamily: 'var(--st-font-mono, monospace)',
                          fontSize: 12.5,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {endpoint.url}
                      </span>
                      {endpoint.description ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--st-text-muted)',
                          }}
                        >
                          {endpoint.description}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {endpoint.events.map((e) => (
                          <Badge key={e} tone="neutral">
                            {e}
                          </Badge>
                        ))}
                      </span>
                    </Td>
                    <Td>
                      {endpoint.lastDeliveryAt ? (
                        <>
                          {new Date(endpoint.lastDeliveryAt).toLocaleString()}{' '}
                          <Badge
                            tone={
                              endpoint.lastStatus && endpoint.lastStatus < 300
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {endpoint.lastStatus ?? 'ERR'}
                          </Badge>
                        </>
                      ) : (
                        'Never'
                      )}
                      {endpoint.failureCount > 0 ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--st-text-muted)',
                          }}
                        >
                          {endpoint.failureCount} consecutive failure
                          {endpoint.failureCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Switch
                        checked={endpoint.active}
                        onCheckedChange={(on) => handleToggleActive(endpoint, on)}
                        aria-label={`Toggle ${endpoint.url}`}
                      />
                    </Td>
                    <Td>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <Button variant="ghost" size="sm" onClick={() => setRotateTarget(endpoint)}>
                          Rotate secret
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(endpoint)}>
                          Delete
                        </Button>
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent deliveries</CardTitle>
            <CardDescription>The last 50 webhook attempts across all endpoints.</CardDescription>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SelectField
              aria-label="Filter deliveries by event"
              options={EVENT_FILTER_OPTIONS}
              value={eventFilter}
              onChange={(v) =>
                setEventFilter(v && isSabpayWebhookEvent(v) ? v : 'all')
              }
              searchable
              size="sm"
            />
            {endpoints.length > 0 ? (
              <SelectField
                aria-label="Filter deliveries by endpoint"
                options={[
                  { value: 'all', label: 'All endpoints' },
                  ...endpoints.map((ep) => ({ value: ep._id, label: ep.url })),
                ]}
                value={endpointFilter}
                onChange={(v) => setEndpointFilter(v ?? 'all')}
                size="sm"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardBody>
          {filterLoading && shownDeliveries.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }} aria-live="polite">
              Loading deliveries…
            </p>
          ) : shownDeliveries.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              {filtersActive
                ? 'No deliveries match the current filter.'
                : 'No deliveries yet — they appear as soon as a payment event fires.'}
            </p>
          ) : (
            <div
              style={{
                opacity: filterLoading ? 0.6 : 1,
                transition: 'opacity 120ms ease',
              }}
              aria-busy={filterLoading || undefined}
            >
              <Table>
                <THead>
                  <Tr>
                    <Th>Event</Th>
                    <Th>Object</Th>
                    <Th>Endpoint</Th>
                    <Th>Result</Th>
                    <Th>Attempts</Th>
                    <Th>When</Th>
                    <Th aria-label="Actions" />
                  </Tr>
                </THead>
                <TBody>
                  {shownDeliveries.map((d) => (
                    <Tr key={d._id}>
                      <Td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Badge tone="neutral">{d.event}</Badge>
                          {d.redeliveredFrom ? <Badge tone="info">Redelivery</Badge> : null}
                        </span>
                      </Td>
                      <Td style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}>
                        {d.objectId ?? d.paymentId}
                      </Td>
                      <Td
                        style={{
                          maxWidth: 260,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12.5,
                        }}
                      >
                        {d.url}
                      </Td>
                      <Td>
                        <Badge tone={d.success ? 'success' : 'danger'}>
                          {d.success ? `OK ${d.status}` : d.status ? `HTTP ${d.status}` : 'No response'}
                        </Badge>
                      </Td>
                      <Td>{d.attempts}</Td>
                      <Td>{new Date(d.createdAt).toLocaleString()}</Td>
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={<RefreshCw size={13} />}
                          loading={redelivering === d._id}
                          disabled={redelivering !== null && redelivering !== d._id}
                          onClick={() => handleRedeliver(d)}
                          aria-label={`Redeliver ${d.event} to ${d.url}`}
                        >
                          Redeliver
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={closeModal}
        title={revealedSecret ? 'Copy the signing secret' : 'Add a webhook endpoint'}
        description={
          revealedSecret
            ? 'This is the only time the secret is shown. Use it to verify X-SabNode-Signature.'
            : 'We deliver a signed JSON envelope for every event you subscribe to.'
        }
        footer={
          revealedSecret ? (
            <Button variant="primary" onClick={closeModal}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="sabpay-create-webhook" disabled={saving}>
                {saving ? 'Adding…' : 'Add endpoint'}
              </Button>
            </>
          )
        }
      >
        {revealedSecret ? (
          <SecretReveal secret={revealedSecret} />
        ) : (
          <form
            id="sabpay-create-webhook"
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label="Endpoint URL" required error={formError}>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstore.com/api/sabpay-webhook"
                required
              />
            </Field>
            <Field
              label="Events"
              help={`${events.length} of ${SABPAY_WEBHOOK_EVENTS.length} events selected.`}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  maxHeight: 320,
                  overflowY: 'auto',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--st-border)',
                  background: 'var(--st-bg)',
                }}
              >
                {EVENT_GROUPS.map((group) => {
                  const headingId = `sabpay-evt-group-${group.prefix}`;
                  return (
                    <div key={group.prefix} role="group" aria-labelledby={headingId}>
                      <p
                        id={headingId}
                        style={{
                          margin: '0 0 6px',
                          fontSize: 11.5,
                          fontWeight: 650,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: 'var(--st-text-muted)',
                        }}
                      >
                        {group.label}
                      </p>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                          gap: '6px 12px',
                        }}
                      >
                        {group.events.map((event) => (
                          <Checkbox
                            key={event}
                            label={event}
                            checked={events.includes(event)}
                            onChange={(e) => toggleEvent(event, e.target.checked)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Production storefront"
                maxLength={200}
              />
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmAction
        open={rotateTarget !== null}
        onClose={() => setRotateTarget(null)}
        onConfirm={async () => {
          if (rotateTarget) await handleRotate(rotateTarget);
        }}
        title="Rotate the signing secret?"
        description={
          rotateTarget
            ? `Deliveries to ${rotateTarget.url} signed with the old secret will stop verifying immediately.`
            : undefined
        }
        confirmLabel="Rotate secret"
        tone="primary"
      />

      <ConfirmAction
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget);
        }}
        title="Delete this endpoint?"
        description={
          deleteTarget
            ? `${deleteTarget.url} will stop receiving events immediately. Its delivery log is kept.`
            : undefined
        }
        confirmLabel="Delete endpoint"
      />
    </>
  );
}
