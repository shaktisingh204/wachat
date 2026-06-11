'use client';

/**
 * Public "start a payment" landing for the non-`pay_` checkout surfaces —
 * payment links, QR codes, and payment pages. It shows the merchant brand +
 * amount, collects whatever the surface needs (an amount for open-amount QRs /
 * customer-decided pages, plus any custom fields a page defines), then POSTs to
 * its session endpoint and forwards the browser to the resulting `/pay/<pay_id>`
 * hosted checkout — so the real payment always runs through ONE state machine.
 *
 * Public surface: NO 20ui (admin-only). Reuses the hosted-checkout CSS + motion.
 */

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { formatSabpayAmount, type SabpayMode, type SabpayPaymentPageField } from '@/lib/sabpay/types';

import '../checkout.css';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface PublicPayLandingProps {
  /** API route to POST the session start to. */
  sessionUrl: string;
  business: { name: string; logoUrl?: string; brandColor: string };
  mode: SabpayMode;
  title: string;
  description?: string;
  currency?: string;
  /** Fixed amount in paise (display only). Omit for amount-editable surfaces. */
  fixedAmount?: number;
  /** When true, the payer enters the amount (open QR / customer-decided page). */
  amountEditable?: boolean;
  /** Minimum amount in paise for amount-editable surfaces. */
  minAmount?: number;
  /** Custom fields collected on payment pages. */
  fields?: SabpayPaymentPageField[];
  /** Optional hero/branding image (payment pages). */
  brandingImageUrl?: string;
  /** Terminal notice instead of the pay form (paid / cancelled / expired / closed). */
  notice?: { title: string; message: string; tone: 'success' | 'failed' };
}

export function PublicPayLanding(props: PublicPayLandingProps) {
  const reduceMotion = useReducedMotion();
  const currency = props.currency ?? 'INR';
  const [amount, setAmount] = React.useState('');
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const brandInitial = props.business.name.trim().charAt(0).toUpperCase() || 'S';
  const enter = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, delay, ease: EASE_OUT },
        };

  const displayAmount =
    props.fixedAmount != null ? formatSabpayAmount(props.fixedAmount, currency) : null;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: { amount?: number; fields?: Record<string, string> } = {};
    if (props.amountEditable) {
      const rupees = Number.parseFloat(amount);
      if (!Number.isFinite(rupees) || rupees < 1) {
        setError('Enter an amount of at least ₹1.');
        return;
      }
      const paise = Math.round(rupees * 100);
      if (props.minAmount != null && paise < props.minAmount) {
        setError(`Minimum amount is ${formatSabpayAmount(props.minAmount, currency)}.`);
        return;
      }
      body.amount = paise;
    }
    if (props.fields && props.fields.length > 0) {
      for (const f of props.fields) {
        if (f.required && !((values[f.key] ?? '').trim())) {
          setError(`Please fill in "${f.label}".`);
          return;
        }
      }
      body.fields = values;
    }

    setBusy(true);
    try {
      const res = await fetch(props.sessionUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.checkoutUrl) {
        setBusy(false);
        setError(json?.error || 'Could not start the payment. Please try again.');
        return;
      }
      window.location.assign(json.checkoutUrl);
    } catch {
      setBusy(false);
      setError('Could not reach the payment service. Please try again.');
    }
  }

  return (
    <main
      className="sabpay-checkout"
      style={{ ['--sp-brand' as string]: props.business.brandColor }}
    >
      <div className="sabpay-checkout__frame">
        <motion.aside className="sabpay-checkout__summary" {...enter(0)}>
          <div className="sabpay-checkout__merchant">
            {props.business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant logos live on R2; remote patterns vary per tenant
              <img src={props.business.logoUrl} alt="" className="sabpay-checkout__logo" />
            ) : (
              <span className="sabpay-checkout__logo sabpay-checkout__logo--initial" aria-hidden="true">
                {brandInitial}
              </span>
            )}
            <span className="sabpay-checkout__merchant-name">{props.business.name}</span>
            {props.mode === 'test' ? (
              <span className="sabpay-checkout__test-badge">Test mode</span>
            ) : null}
          </div>

          {displayAmount ? (
            <motion.p className="sabpay-checkout__amount" {...enter(0.06)}>
              {displayAmount}
            </motion.p>
          ) : (
            <motion.p className="sabpay-checkout__amount" {...enter(0.06)} style={{ opacity: 0.7 }}>
              Enter amount
            </motion.p>
          )}
          <motion.p className="sabpay-checkout__description" {...enter(0.1)}>
            {props.title}
            {props.description ? ` — ${props.description}` : ''}
          </motion.p>

          <div className="sabpay-checkout__summary-foot">
            <span className="sabpay-checkout__lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            Payments are encrypted end-to-end and processed by PayU.
          </div>
        </motion.aside>

        <section className="sabpay-checkout__panel">
          {props.notice ? (
            <div className="sabpay-checkout__state">
              <span
                className={`sabpay-checkout__status-icon sabpay-checkout__status-icon--${props.notice.tone}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {props.notice.tone === 'success' ? (
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  ) : (
                    <path d="M6 6l12 12M18 6L6 18" />
                  )}
                </svg>
              </span>
              <h1>{props.notice.title}</h1>
              <p>{props.notice.message}</p>
            </div>
          ) : (
            <form className="sabpay-checkout__form" onSubmit={start}>
              <h1 className="sabpay-checkout__title">{props.title}</h1>

              {props.brandingImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant SabFiles asset; remote patterns vary per tenant
                <img
                  src={props.brandingImageUrl}
                  alt=""
                  style={{ width: '100%', borderRadius: 12, marginBottom: 6 }}
                />
              ) : null}

              {props.amountEditable ? (
                <div className="sabpay-checkout__field">
                  <label htmlFor="sp-amount">Amount (₹)</label>
                  <input
                    id="sp-amount"
                    type="number"
                    min={1}
                    step="0.01"
                    inputMode="decimal"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              ) : null}

              {(props.fields ?? []).map((f) => (
                <div className="sabpay-checkout__field" key={f.key}>
                  <label htmlFor={`sp-f-${f.key}`}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  <input
                    id={`sp-f-${f.key}`}
                    type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                    required={f.required}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              ))}

              {error ? (
                <p className="sabpay-checkout__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="sabpay-checkout__pay" disabled={busy}>
                {busy ? 'Starting…' : displayAmount ? `Pay ${displayAmount}` : 'Continue to payment'}
              </button>

              <p className="sabpay-checkout__powered">
                Powered by <strong>SabPay</strong>
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
