'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  ChevronLeft,
  Undo2,
  LoaderCircle,
} from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getPaymentById,
  refundPayment,
} from '@/app/actions/worksuite/payments.actions';

const STATUS_TONES: Record<
  string,
  'green' | 'amber' | 'red' | 'neutral'
> = {
  completed: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'neutral',
};

function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  } catch {
    return `${currency} ${amount || 0}`;
  }
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ paymentId: string }>();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    if (!params.paymentId) return;
    (async () => {
      const p = await getPaymentById(params.paymentId);
      setPayment(p);
      if (p?.amount) {
        setRefundAmount(
          String(Math.max(0, Number(p.amount) - Number(p.refunded_amount || 0))),
        );
      }
      setLoading(false);
    })();
  }, [params.paymentId]);

  const onRefund = () => {
    startTransition(async () => {
      const res = await refundPayment(
        params.paymentId,
        Number(refundAmount),
        refundReason,
      );
      if (res.error) {
        toast({
          title: 'Refund failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Refund recorded' });
      const p = await getPaymentById(params.paymentId);
      setPayment(p);
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
      </div>
    );
  }
  if (!payment) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[13px] text-clay-ink-muted">
          Payment not found.
        </p>
        <Link href="/dashboard/crm/sales/payments">
          <ClayButton variant="ghost">Back to payments</ClayButton>
        </Link>
      </div>
    );
  }

  const refundable =
    Number(payment.amount || 0) - Number(payment.refunded_amount || 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Payment ${payment.transaction_id || payment._id}`}
        subtitle={
          payment.invoice_number
            ? `Against invoice ${payment.invoice_number}`
            : 'Payment detail'
        }
        icon={CreditCard}
        actions={
          <Link href="/dashboard/crm/sales/payments">
            <ClayButton
              variant="ghost"
              leading={<ChevronLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ClayCard>
          <h3 className="mb-3 text-[15px] font-semibold text-clay-ink">
            Details
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <dt className="text-clay-ink-muted">Status</dt>
            <dd>
              <ClayBadge
                tone={STATUS_TONES[payment.status] || 'neutral'}
                dot
              >
                {payment.status}
              </ClayBadge>
            </dd>

            <dt className="text-clay-ink-muted">Gateway</dt>
            <dd className="text-clay-ink">{payment.gateway}</dd>

            <dt className="text-clay-ink-muted">Amount</dt>
            <dd className="font-semibold text-clay-ink">
              {formatMoney(payment.amount, payment.currency)}
            </dd>

            {payment.refunded_amount ? (
              <>
                <dt className="text-clay-ink-muted">Refunded</dt>
                <dd className="text-clay-ink">
                  {formatMoney(payment.refunded_amount, payment.currency)}
                </dd>
              </>
            ) : null}

            <dt className="text-clay-ink-muted">Paid on</dt>
            <dd className="text-clay-ink">
              {payment.paid_on
                ? new Date(payment.paid_on).toLocaleDateString()
                : '—'}
            </dd>

            <dt className="text-clay-ink-muted">Transaction ID</dt>
            <dd className="font-mono text-[12px] text-clay-ink">
              {payment.transaction_id || '—'}
            </dd>

            <dt className="text-clay-ink-muted">Client</dt>
            <dd className="text-clay-ink">{payment.client_name || '—'}</dd>

            <dt className="text-clay-ink-muted">Remarks</dt>
            <dd className="text-clay-ink">{payment.remarks || '—'}</dd>
          </dl>
        </ClayCard>

        <ClayCard>
          <h3 className="mb-3 text-[15px] font-semibold text-clay-ink">
            Refund
          </h3>
          {refundable <= 0 ? (
            <p className="text-[13px] text-clay-ink-muted">
              No refundable balance remaining on this payment.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="refund_amount" className="text-[12.5px]">
                  Refund amount (max {formatMoney(refundable, payment.currency)})
                </Label>
                <Input
                  id="refund_amount"
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label htmlFor="refund_reason" className="text-[12.5px]">
                  Reason
                </Label>
                <Textarea
                  id="refund_reason"
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="flex justify-end">
                <ClayButton
                  type="button"
                  variant="obsidian"
                  disabled={isPending || !refundAmount}
                  onClick={onRefund}
                  leading={
                    isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                    )
                  }
                >
                  Record Refund
                </ClayButton>
              </div>
            </div>
          )}
        </ClayCard>
      </div>
    </div>
  );
}
