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

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getPaymentById,
  refundPayment,
} from '@/app/actions/worksuite/payments.actions';

const STATUS_VARIANTS: Record<
  string,
  'success' | 'warning' | 'danger' | 'ghost'
> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'ghost',
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
  const { toast } = useZoruToast();
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
      <div className="flex justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }
  if (!payment) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[13px] text-zoru-ink-muted">
          Payment not found.
        </p>
        <Link href="/dashboard/crm/sales/payments">
          <ZoruButton variant="ghost">Back to payments</ZoruButton>
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
            <ZoruButton variant="ghost">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </ZoruButton>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ZoruCard className="p-6">
          <h3 className="mb-3 text-[15px] text-zoru-ink">
            Details
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <dt className="text-zoru-ink-muted">Status</dt>
            <dd>
              <ZoruBadge variant={STATUS_VARIANTS[payment.status] || 'ghost'}>
                {payment.status}
              </ZoruBadge>
            </dd>

            <dt className="text-zoru-ink-muted">Gateway</dt>
            <dd className="text-zoru-ink">{payment.gateway}</dd>

            <dt className="text-zoru-ink-muted">Amount</dt>
            <dd className="text-zoru-ink">
              {formatMoney(payment.amount, payment.currency)}
            </dd>

            {payment.refunded_amount ? (
              <>
                <dt className="text-zoru-ink-muted">Refunded</dt>
                <dd className="text-zoru-ink">
                  {formatMoney(payment.refunded_amount, payment.currency)}
                </dd>
              </>
            ) : null}

            <dt className="text-zoru-ink-muted">Paid on</dt>
            <dd className="text-zoru-ink">
              {payment.paid_on
                ? new Date(payment.paid_on).toLocaleDateString()
                : '—'}
            </dd>

            <dt className="text-zoru-ink-muted">Transaction ID</dt>
            <dd className="font-mono text-[12px] text-zoru-ink">
              {payment.transaction_id || '—'}
            </dd>

            <dt className="text-zoru-ink-muted">Client</dt>
            <dd className="text-zoru-ink">{payment.client_name || '—'}</dd>

            <dt className="text-zoru-ink-muted">Remarks</dt>
            <dd className="text-zoru-ink">{payment.remarks || '—'}</dd>
          </dl>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h3 className="mb-3 text-[15px] text-zoru-ink">
            Refund
          </h3>
          {refundable <= 0 ? (
            <p className="text-[13px] text-zoru-ink-muted">
              No refundable balance remaining on this payment.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <ZoruLabel htmlFor="refund_amount" className="text-[12.5px]">
                  Refund amount (max {formatMoney(refundable, payment.currency)})
                </ZoruLabel>
                <ZoruInput
                  id="refund_amount"
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>
              <div>
                <ZoruLabel htmlFor="refund_reason" className="text-[12.5px]">
                  Reason
                </ZoruLabel>
                <ZoruTextarea
                  id="refund_reason"
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <ZoruButton
                  type="button"
                  disabled={isPending || !refundAmount}
                  onClick={onRefund}
                >
                  {isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  Record Refund
                </ZoruButton>
              </div>
            </div>
          )}
        </ZoruCard>
      </div>
    </div>
  );
}
