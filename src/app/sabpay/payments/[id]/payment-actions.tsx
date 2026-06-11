'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Undo2 } from 'lucide-react';

import {
  Button,
  Field,
  Input,
  Modal,
  SegmentedControl,
  toast,
} from '@/components/sabcrm/20ui';
import {
  formatSabpayAmount,
  type SabpayPaymentStatus,
} from '@/lib/sabpay/types';

import { createSabpayRefund } from '../../actions/refunds';

type RefundScope = 'full' | 'partial';

const SCOPES: Array<{ value: RefundScope; label: string }> = [
  { value: 'full', label: 'Full' },
  { value: 'partial', label: 'Partial' },
];

function paiseToRupeesString(paise: number): string {
  const rupees = paise / 100;
  return rupees % 1 === 0 ? String(rupees) : rupees.toFixed(2);
}

export function PaymentActions({
  paymentId,
  status,
  amount,
  amountRefunded,
  currency,
}: {
  paymentId: string;
  status: SabpayPaymentStatus;
  amount: number;
  amountRefunded: number;
  currency: string;
}) {
  const router = useRouter();
  const refundable = amount - amountRefunded;

  const [open, setOpen] = React.useState(false);
  const [scope, setScope] = React.useState<RefundScope>('full');
  const [rupees, setRupees] = React.useState(() => paiseToRupeesString(refundable));
  const [reason, setReason] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  if (status !== 'succeeded' || refundable <= 0) return null;

  const maxRupees = refundable / 100;

  function handleScopeChange(next: RefundScope) {
    setScope(next);
    setFormError(null);
    if (next === 'full') setRupees(paiseToRupeesString(refundable));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    let paise: number | undefined;
    if (scope === 'partial') {
      const value = Number.parseFloat(rupees);
      if (!Number.isFinite(value) || value <= 0) {
        setFormError('Enter a refund amount greater than ₹0.');
        return;
      }
      paise = Math.round(value * 100);
      if (paise > refundable) {
        setFormError(
          `You can refund at most ${formatSabpayAmount(refundable, currency)} on this payment.`,
        );
        return;
      }
    }

    setSubmitting(true);
    const result = await createSabpayRefund(paymentId, {
      amount: paise,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (result.error || !result.refund) {
      setFormError(result.error || 'Could not create the refund.');
      return;
    }
    setOpen(false);
    setScope('full');
    setReason('');
    toast({
      title: 'Refund created',
      description: `${result.refund.id} for ${formatSabpayAmount(result.refund.amount, result.refund.currency)}.`,
      tone: 'success',
    });
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        iconLeft={<Undo2 size={15} />}
        onClick={() => {
          setRupees(paiseToRupeesString(refundable));
          setScope('full');
          setFormError(null);
          setOpen(true);
        }}
      >
        Refund
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Refund payment"
        description={`Returns up to ${formatSabpayAmount(refundable, currency)} to the customer's original payment method.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="sabpay-create-refund"
              disabled={submitting}
            >
              {submitting ? 'Refunding…' : 'Refund'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-create-refund"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Refund type">
            <SegmentedControl
              aria-label="Refund type"
              items={SCOPES}
              value={scope}
              onChange={handleScopeChange}
            />
          </Field>
          <Field
            label="Amount (₹)"
            required
            error={formError}
            help={
              scope === 'full'
                ? 'Refunds the full remaining amount.'
                : `Up to ${formatSabpayAmount(refundable, currency)}.`
            }
          >
            <Input
              type="number"
              min={0.01}
              max={maxRupees}
              step="0.01"
              inputMode="decimal"
              value={rupees}
              onChange={(e) => setRupees(e.target.value)}
              readOnly={scope === 'full'}
              aria-readonly={scope === 'full' || undefined}
              required
            />
          </Field>
          <Field label="Reason" help="Optional. Shown alongside the refund in your dashboard.">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer request"
              maxLength={200}
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
