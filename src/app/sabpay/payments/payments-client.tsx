'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
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
import {
  formatSabpayAmount,
  type SabpayMode,
  type SabpayPayment,
  type SabpayPaymentStatus,
} from '@/lib/sabpay/types';

import { createSabpayPayment } from '../actions';
import { PaymentStatusBadge } from '../_components/payment-status-badge';

type StatusFilter = 'all' | SabpayPaymentStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'created', label: 'Open' },
  { value: 'failed', label: 'Failed' },
];

export function PaymentsClient({
  initialPayments,
  mode,
}: {
  initialPayments: SabpayPayment[];
  mode: SabpayMode;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [successUrl, setSuccessUrl] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const payments =
    filter === 'all'
      ? initialPayments
      : initialPayments.filter((p) => p.status === filter);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rupees = Number.parseFloat(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      setFormError('Enter an amount of at least ₹1.');
      return;
    }
    setCreating(true);
    const result = await createSabpayPayment({
      amount: Math.round(rupees * 100),
      description: description || undefined,
      successUrl: successUrl || undefined,
    });
    setCreating(false);
    if (result.error || !result.payment) {
      setFormError(result.error || 'Could not create the payment.');
      return;
    }
    setCreateOpen(false);
    setAmount('');
    setDescription('');
    setSuccessUrl('');
    try {
      await navigator.clipboard.writeText(result.payment.checkoutUrl);
      toast({ title: 'Payment created', description: 'Checkout link copied to clipboard.', tone: 'success' });
    } catch {
      toast({ title: 'Payment created', description: result.payment.checkoutUrl });
    }
    router.refresh();
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <SegmentedControl
          aria-label="Filter payments by status"
          items={FILTERS}
          value={filter}
          onChange={setFilter}
        />
        <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
          Create payment link
        </Button>
      </div>

      <Card>
        <CardBody>
          {payments.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              No {filter === 'all' ? '' : `${filter} `}payments in {mode} mode yet.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Payment</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Customer</Th>
                  <Th>Description</Th>
                  <Th>Created</Th>
                </Tr>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/sabpay/payments/${p.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {p.id}
                      </Link>
                    </Td>
                    <Td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatSabpayAmount(p.amount, p.currency)}
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={p.status} />
                    </Td>
                    <Td>{p.customer.email || p.customer.name || '—'}</Td>
                    <Td>{p.description}</Td>
                    <Td>{new Date(p.createdAt).toLocaleString()}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a payment link"
        description={`Creates a ${mode}-mode payment and copies its hosted checkout URL — share it anywhere.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sabpay-create-payment" disabled={creating}>
              {creating ? 'Creating…' : 'Create link'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-payment"
          onSubmit={handleCreate}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Amount (₹)" required error={formError}>
            <Input
              type="number"
              min={1}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="499"
              required
            />
          </Field>
          <Field label="Description" help="Shown to the customer on the checkout page.">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pro plan, March"
              maxLength={200}
            />
          </Field>
          <Field
            label="Redirect after payment"
            help="Optional. Customers return here with sabpay_payment_id + sabpay_status appended."
          >
            <Input
              type="url"
              value={successUrl}
              onChange={(e) => setSuccessUrl(e.target.value)}
              placeholder="https://yourstore.com/thank-you"
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
