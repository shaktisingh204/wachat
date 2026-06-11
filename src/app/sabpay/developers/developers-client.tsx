'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, KeyRound, Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import type { SabpayApiKey, SabpayMode } from '@/lib/sabpay/types';

import { createSabpayKey, revokeSabpayKey } from '../actions';

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          borderRadius: 10,
          border: '1px solid var(--st-border)',
          background: 'var(--st-bg)',
          overflowX: 'auto',
          fontFamily: 'var(--st-font-mono, monospace)',
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        <code>{children}</code>
      </pre>
      <span style={{ position: 'absolute', top: 8, right: 8 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
          aria-label="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </span>
    </div>
  );
}

const CREATE_SNIPPET = (apiBase: string) => `curl ${apiBase}/payments \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 49900,
    "currency": "INR",
    "description": "Pro plan",
    "success_url": "https://yourstore.com/thank-you",
    "cancel_url": "https://yourstore.com/checkout",
    "metadata": { "order_id": "ord_8731" }
  }'

# → { "id": "pay_…", "checkout_url": "https://…/pay/pay_…", … }
# Redirect your customer to checkout_url. After payment we send them
# back to your success_url/cancel_url with sabpay_payment_id +
# sabpay_status appended, and POST a signed webhook to your endpoint.`;

const VERIFY_SNIPPET = `import crypto from "node:crypto";

export function verifySabpayWebhook(rawBody, signatureHeader, secret) {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return (
    expected.length === signatureHeader.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
  );
}

// In your handler:
// const ok = verifySabpayWebhook(rawBody, req.headers["x-sabnode-signature"], "whsec_…");
// const { event, data } = JSON.parse(rawBody);  // event: "payment.succeeded"`;

export function DevelopersClient({
  initialKeys,
  apiBase,
}: {
  initialKeys: SabpayApiKey[];
  apiBase: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [mode, setMode] = React.useState<SabpayMode>('test');
  const [creating, setCreating] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    const result = await createSabpayKey({ name: name || 'Secret key', mode });
    setCreating(false);
    if (result.error || !result.key?.secret) {
      setFormError(result.error || 'Could not create the key.');
      return;
    }
    setRevealedSecret(result.key.secret);
    setName('');
    router.refresh();
  }

  async function handleRevoke(key: SabpayApiKey) {
    if (!window.confirm(`Revoke "${key.name}" (${key.display})? API calls with it will start failing immediately.`)) {
      return;
    }
    const result = await revokeSabpayKey(key._id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast({ title: 'Key revoked', tone: 'success' });
    router.refresh();
  }

  function closeCreate() {
    setCreateOpen(false);
    setRevealedSecret(null);
    setFormError(null);
  }

  const createButton = (
    <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
      Create key
    </Button>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Secret keys</CardTitle>
            <CardDescription>
              Test keys (sk_test_…) drive the payment simulator; live keys
              (sk_live_…) charge real money via PayU. Keys are shown once and
              stored hashed.
            </CardDescription>
          </div>
          {createButton}
        </CardHeader>
        <CardBody>
          {initialKeys.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={22} />}
              title="No secret keys yet"
              description="Create a secret key to call the SabPay API from your server."
              action={createButton}
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Mode</Th>
                  <Th>Last used</Th>
                  <Th>Created</Th>
                  <Th aria-label="Actions" />
                </Tr>
              </THead>
              <TBody>
                {initialKeys.map((key) => (
                  <Tr key={key._id}>
                    <Td>{key.name}</Td>
                    <Td style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}>
                      {key.display}
                    </Td>
                    <Td>
                      <Badge tone={key.mode === 'live' ? 'success' : 'warning'}>
                        {key.mode}
                      </Badge>
                    </Td>
                    <Td>
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </Td>
                    <Td>{new Date(key.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      {key.revoked ? (
                        <Badge tone="danger">Revoked</Badge>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(key)}>
                          Revoke
                        </Button>
                      )}
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
            <CardTitle>Quickstart — create a payment</CardTitle>
            <CardDescription>
              One POST creates a payment session and returns a hosted
              checkout_url. Amounts are integers in paise (₹499 → 49900).
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <CodeBlock>{CREATE_SNIPPET(apiBase)}</CodeBlock>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Verify webhook signatures</CardTitle>
            <CardDescription>
              Every webhook is signed with your endpoint's whsec_ secret in the
              X-SabNode-Signature header. Reject anything that doesn't verify.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <CodeBlock>{VERIFY_SNIPPET}</CodeBlock>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={revealedSecret ? 'Copy your new key' : 'Create a secret key'}
        description={
          revealedSecret
            ? 'This is the only time the full key is shown. Store it somewhere safe.'
            : 'The key inherits its mode forever — test keys can never charge real money.'
        }
        footer={
          revealedSecret ? (
            <Button variant="primary" onClick={closeCreate}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCreate}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="sabpay-create-key"
                disabled={creating}
                iconLeft={<KeyRound size={15} />}
              >
                {creating ? 'Creating…' : 'Create key'}
              </Button>
            </>
          )
        }
      >
        {revealedSecret ? (
          <CodeBlock>{revealedSecret}</CodeBlock>
        ) : (
          <form
            id="sabpay-create-key"
            onSubmit={handleCreate}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <Field label="Name" help="Where will this key live? e.g. “Storefront backend”." error={formError}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Storefront backend"
                maxLength={80}
              />
            </Field>
            <Field label="Mode">
              <SegmentedControl
                aria-label="Key mode"
                items={[
                  { value: 'test', label: 'Test' },
                  { value: 'live', label: 'Live' },
                ]}
                value={mode}
                onChange={setMode}
              />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}
