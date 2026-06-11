'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Plus } from 'lucide-react';

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
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  SABPAY_WEBHOOK_EVENTS,
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
    if (!window.confirm('Rotate the signing secret? Deliveries signed with the old secret will stop verifying.')) {
      return;
    }
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
    if (!window.confirm(`Delete the endpoint ${endpoint.url}?`)) return;
    const result = await deleteSabpayWebhook(endpoint._id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast({ title: 'Endpoint deleted', tone: 'success' });
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
                        <Button variant="ghost" size="sm" onClick={() => handleRotate(endpoint)}>
                          Rotate secret
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(endpoint)}>
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
        </CardHeader>
        <CardBody>
          {deliveries.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No deliveries yet — they appear as soon as a payment event fires.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Event</Th>
                  <Th>Payment</Th>
                  <Th>Endpoint</Th>
                  <Th>Result</Th>
                  <Th>Attempts</Th>
                  <Th>When</Th>
                </Tr>
              </THead>
              <TBody>
                {deliveries.map((d) => (
                  <Tr key={d._id}>
                    <Td>
                      <Badge tone="neutral">{d.event}</Badge>
                    </Td>
                    <Td style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}>
                      {d.paymentId}
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
                  </Tr>
                ))}
              </TBody>
            </Table>
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
            <Field label="Events">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SABPAY_WEBHOOK_EVENTS.map((event) => (
                  <Checkbox
                    key={event}
                    label={event}
                    checked={events.includes(event)}
                    onChange={(e) => toggleEvent(event, e.target.checked)}
                  />
                ))}
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
    </>
  );
}
