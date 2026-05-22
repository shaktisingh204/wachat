'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, ZoruCardContent, Button, Input, Label, Select } from '@/components/zoruui';
import { CreditCard, LoaderCircle, Terminal } from 'lucide-react';
import { recordPublicPayment } from '@/app/actions/worksuite/public.actions';

const GATEWAYS = [
  { value: 'stripe', label: 'Stripe API' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'paypal', label: 'PayPal Secure' },
  { value: 'bank-transfer', label: 'Bank wire' },
  { value: 'other', label: 'Alternative method' },
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
      setError('Enter a valid payment amount.');
      return;
    }
    if (!txId.trim()) {
      setError('Enter the gateway transaction ID.');
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
    <Card className="shadow-md border-foreground/10">
      <ZoruCardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            application/json
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment_amount" className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
              payment_amount ({currency}) <span className="text-danger">*</span>
            </Label>
            <Input
              id="payment_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment_gateway" className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
              payment_gateway <span className="text-danger">*</span>
            </Label>
            <Select
              id="payment_gateway"
              options={GATEWAYS}
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transaction_id" className="text-[12px] font-mono uppercase tracking-tight text-muted-foreground">
              transaction_id <span className="text-danger">*</span>
            </Label>
            <Input
              id="transaction_id"
              placeholder="e.g. ch_1Nx..., pi_3Nx..."
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>
        </div>

        {error ? (
          <p className="text-[12px] font-mono text-danger font-medium bg-danger/5 border border-danger/25 p-2.5 rounded-lg">
            ERR_PAYMENT_RECORD_FAILED: {error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end">
          <Button
            variant="default"
            className="font-mono text-[12px] h-9 px-4 w-full sm:w-auto min-w-40"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                RECORDING...
              </>
            ) : (
              <>
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                POST // PAY_INVOICE
              </>
            )}
          </Button>
        </div>

        {/* DETAILS */}
        <p className="mt-1 text-[11px] font-mono text-muted-foreground leading-normal border-t border-border pt-3">
          // Submit the verified payment receipt transaction from your selected clearing provider.
          Balances reconcile in near-realtime after posting.
        </p>

        {/* CURL SAMPLE */}
        <div className="mt-2 rounded-lg bg-secondary/40 border border-border p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">// Curl representation</p>
          <pre className="text-[10.5px] font-mono text-foreground whitespace-pre-wrap leading-tight bg-secondary/80 p-2.5 rounded border border-border/50">
            {`curl -X POST https://api.sabnode.com/v1/invoices/${token.slice(0, 6)}/pay \\
  -H "Content-Type: application/json" \\
  -d '{"amount": ${amount || '0.0'}, "gateway": "${gateway}", "transaction_id": "${txId || '...'}"}'`}
          </pre>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
