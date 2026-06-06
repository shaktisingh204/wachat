'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, ZoruCardContent, Button, Input, Label, Select } from '@/components/sabcrm/20ui/compat';
import { CreditCard, LoaderCircle, Terminal, HeartHandshake, Info } from 'lucide-react';
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
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>('');
  
  // Calculate total amount based on due and tip
  const tipAmount = tipPercentage > 0 ? due * (tipPercentage / 100) : Number(customTip || 0);
  const totalAmount = (due + tipAmount).toFixed(2);

  const [gateway, setGateway] = useState('stripe');
  const [txId, setTxId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const num = Number(totalAmount);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    if (!txId.trim()) {
      setError('Enter the gateway transaction ID.');
      return;
    }
    setBusy(true);
    try {
      const res = await recordPublicPayment(token, {
        amount: num,
        gateway,
        transactionId: txId.trim(),
      });
      if (!res.success) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.push('/p/thanks?type=invoice');
    } catch (err: any) {
      setError(err?.message || 'An unexpected API error occurred.');
      setBusy(false);
    }
  };

  const handleTipClick = (pct: number) => {
    if (tipPercentage === pct) {
      setTipPercentage(0);
    } else {
      setTipPercentage(pct);
      setCustomTip('');
    }
  };

  return (
    <Card className="shadow-md border-foreground/10">
      <ZoruCardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-mono uppercase tracking-wider text-zoru-ink flex items-center gap-1.5">
            <Terminal className="h-4 w-4 text-zoru-ink-muted" />
            Payload parameters
          </h2>
          <span className="text-[10px] font-mono bg-zoru-surface-2 px-1.5 py-0.5 rounded text-zoru-ink-muted">
            application/json
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment_gateway" className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted">
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

          {(gateway === 'bank-transfer' || gateway === 'other') && (
            <div className="bg-zoru-surface-2/40 border border-zoru-line p-3 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-zoru-ink-muted mt-0.5 shrink-0" />
              <div className="text-[12px] text-zoru-ink-muted">
                <p className="font-semibold text-zoru-ink mb-1">Offline Payment Instructions</p>
                <p>Please transfer the total amount to the following bank account:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-[11px]">
                  <li>Bank: Acme Global Bank</li>
                  <li>Account Name: SabNode Technologies</li>
                  <li>Account Number: 123456789012</li>
                  <li>Routing / IFSC: SABN0001234</li>
                </ul>
                <p className="mt-2">After transferring, please enter the transaction reference ID below to submit for verification.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transaction_id" className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted">
              transaction_id <span className="text-danger">*</span>
            </Label>
            <Input
              id="transaction_id"
              placeholder={gateway === 'bank-transfer' ? "e.g. TRN-987654321" : "e.g. ch_1Nx..., pi_3Nx..."}
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              disabled={busy}
              className="font-mono text-[12.5px]"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-zoru-line">
            <Label className="text-[12px] font-mono uppercase tracking-tight text-zoru-ink-muted flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" /> add_tip (optional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20].map((pct) => (
                <Button
                  key={pct}
                  variant={tipPercentage === pct ? 'default' : 'outline'}
                  size="sm"
                  type="button"
                  onClick={() => handleTipClick(pct)}
                  disabled={busy}
                  className="font-mono text-xs flex-1 h-8"
                >
                  {pct}%
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] font-mono text-zoru-ink-muted">or custom:</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={customTip}
                onChange={(e) => {
                  setCustomTip(e.target.value);
                  setTipPercentage(0);
                }}
                disabled={busy}
                className="font-mono text-[12.5px] h-8 flex-1"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2 bg-zoru-surface-2/20 p-3 rounded-lg border border-zoru-line">
            <div className="flex justify-between items-center text-[12px] text-zoru-ink-muted font-mono">
              <span>Invoice Due:</span>
              <span>{due.toFixed(2)} {currency}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between items-center text-[12px] text-zoru-ink-muted font-mono">
                <span>Tip Amount:</span>
                <span>{tipAmount.toFixed(2)} {currency}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[13px] font-bold text-zoru-ink font-mono mt-1 pt-1 border-t border-zoru-line/50">
              <span>payment_amount:</span>
              <span>{totalAmount} {currency}</span>
            </div>
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
        <p className="mt-1 text-[11px] font-mono text-zoru-ink-muted leading-normal border-t border-zoru-line pt-3">
          // Submit the verified payment receipt transaction from your selected clearing provider.
          Balances reconcile in near-realtime after posting.
        </p>

        {/* CURL SAMPLE */}
        <div className="mt-2 rounded-lg bg-zoru-surface-2/40 border border-zoru-line p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zoru-ink-muted mb-1.5">// Curl representation</p>
          <pre className="text-[10.5px] font-mono text-zoru-ink whitespace-pre-wrap leading-tight bg-zoru-surface-2/80 p-2.5 rounded border border-zoru-line/50">
            {`curl -X POST https://api.sabnode.com/v1/invoices/${token.slice(0, 6)}/pay \\
  -H "Content-Type: application/json" \\
  -d '{"amount": ${totalAmount}, "gateway": "${gateway}", "transaction_id": "${txId || '...'}"}'`}
          </pre>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
