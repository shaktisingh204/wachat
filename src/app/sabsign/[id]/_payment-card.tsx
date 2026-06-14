'use client';

import * as React from 'react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/sabcrm/20ui';
import {
  setEnvelopePaymentRequirement,
  clearEnvelopePaymentRequirement,
  getEnvelopePaymentPublic,
  type EnvelopePaymentView,
} from '@/app/actions/sabsign-payments.actions';

/**
 * Sender-side control to require a payment (collected via SabPay) before the
 * signer can finish. Requires a verified SabPay merchant account (KYC).
 */
export function RequirePaymentCard({ envelopeId }: { envelopeId: string }) {
  const [view, setView] = React.useState<EnvelopePaymentView | null>(null);
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    getEnvelopePaymentPublic(envelopeId).then(setView).catch(() => {});
  }, [envelopeId]);
  React.useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await setEnvelopePaymentRequirement(envelopeId, amt);
    if (!res.ok) setError(res.error ?? 'Could not require payment.');
    else {
      setAmount('');
      load();
    }
    setBusy(false);
  }

  async function clear() {
    setBusy(true);
    setError(null);
    await clearEnvelopePaymentRequirement(envelopeId);
    load();
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collect payment</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {view?.required ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--st-text)]">
              {view.currency} {view.amount}{' '}
              <span
                className={
                  view.paid
                    ? 'text-[var(--st-status-ok,#16a34a)]'
                    : 'text-[var(--st-text-secondary)]'
                }
              >
                · {view.paid ? 'paid' : 'awaiting payment'}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={clear} disabled={busy}>
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <Button onClick={save} disabled={busy}>
              Require payment
            </Button>
          </div>
        )}
        {error ? (
          <p className="text-xs text-[var(--st-status-danger,#dc2626)]">{error}</p>
        ) : null}
        <p className="text-xs text-[var(--st-text-secondary)]">
          Collected via SabPay before the signer can finish. Requires a verified
          SabPay account.
        </p>
      </CardBody>
    </Card>
  );
}
