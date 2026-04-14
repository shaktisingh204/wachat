'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { recordPublicPayment } from '@/app/actions/worksuite/public.actions';

const GATEWAYS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];

export function InvoicePayForm({
  token,
  due,
  currency,
}: {
  token: string;
  due: number;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(due || ''));
  const [gateway, setGateway] = useState('stripe');
  const [txId, setTxId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!txId.trim()) {
      setError('Enter the transaction id.');
      return;
    }
    setBusy(true);
    const res = await recordPublicPayment(token, {
      amount: num,
      gateway,
      transactionId: txId.trim(),
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.push('/p/thanks?type=invoice');
  };

  return (
    <ClayCard>
      <div className="mb-3 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-clay-rose-ink" />
        <h2 className="text-[15px] font-semibold text-clay-ink">
          Record payment
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
          Amount ({currency})
          <ClayInput
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
          Gateway
          <ClaySelect
            options={GATEWAYS}
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
          Transaction id
          <ClayInput
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="e.g. pi_3Nx…"
            disabled={busy}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-[12.5px] text-clay-rose-ink">{error}</p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <ClayButton
          variant="obsidian"
          onClick={submit}
          disabled={busy}
          leading={
            busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )
          }
        >
          Submit payment
        </ClayButton>
      </div>
      <p className="mt-2 text-[11.5px] text-clay-ink-muted">
        Record a payment you have already completed via the selected gateway.
        Your merchant will reconcile the invoice shortly.
      </p>
    </ClayCard>
  );
}
