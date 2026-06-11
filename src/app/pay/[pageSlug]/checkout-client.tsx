'use client';

/**
 * SabPay hosted checkout — client surface.
 *
 * Motion notes (emil-design-eng): one entrance stagger on load (rare,
 * first-time view → delight is allowed), ease-out custom curve under
 * 300ms, press feedback on the pay button, and a single state morph
 * (form → processing → receipt). Everything respects
 * prefers-reduced-motion via useReducedMotion.
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { formatSabpayAmount, type SabpayMode, type SabpayPaymentStatus } from '@/lib/sabpay/types';

import './checkout.css';

export interface CheckoutData {
  paymentId: string;
  mode: SabpayMode;
  status: SabpayPaymentStatus;
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  successUrl?: string;
  cancelUrl?: string;
  failureReason?: string;
  business: {
    name: string;
    logoUrl?: string;
    brandColor: string;
  };
}

type Phase = 'form' | 'processing' | 'succeeded' | 'failed';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function statusToPhase(status: SabpayPaymentStatus): Phase {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'failed') return 'failed';
  return 'form';
}

/** Submits a hidden form to PayU with the signed field set. */
function postToPayu(action: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function CheckoutClient({ data }: { data: CheckoutData }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<Phase>(statusToPhase(data.status));
  const [name, setName] = React.useState(data.customerName);
  const [email, setEmail] = React.useState(data.customerEmail);
  const [phone, setPhone] = React.useState(data.customerPhone);
  const [error, setError] = React.useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = React.useState<string | null>(null);

  const amountLabel = formatSabpayAmount(data.amount, data.currency);
  const brandInitial = data.business.name.trim().charAt(0).toUpperCase() || 'S';

  const enter = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, delay, ease: EASE_OUT },
        };

  async function payLive(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('processing');
    try {
      const res = await fetch(
        `/api/sabpay/checkout/${data.paymentId}/payu-session`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, email, phone }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setPhase('form');
        setError(json?.error || 'Something went wrong. Please try again.');
        return;
      }
      postToPayu(json.action, json.fields);
      // The browser navigates to PayU now; leave the processing state up.
    } catch {
      setPhase('form');
      setError('Could not reach the payment service. Please try again.');
    }
  }

  async function simulate(outcome: 'success' | 'failure') {
    setError(null);
    setPhase('processing');
    try {
      const res = await fetch(
        `/api/sabpay/checkout/${data.paymentId}/simulate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ outcome, name, email }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setPhase('form');
        setError(json?.error || 'Simulation failed. Please try again.');
        return;
      }
      setRedirectUrl(json.redirect_url ?? null);
      setPhase(json.status === 'succeeded' ? 'succeeded' : 'failed');
      if (json.redirect_url) {
        window.setTimeout(() => {
          window.location.assign(json.redirect_url);
        }, 1600);
      }
    } catch {
      setPhase('form');
      setError('Could not reach the payment service. Please try again.');
    }
  }

  return (
    <main
      className="sabpay-checkout"
      style={{ ['--sp-brand' as string]: data.business.brandColor }}
    >
      <div className="sabpay-checkout__frame">
        {/* ── Brand / order summary panel ───────────────────────────── */}
        <motion.aside className="sabpay-checkout__summary" {...enter(0)}>
          <div className="sabpay-checkout__merchant">
            {data.business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- merchant logos live on R2; remote patterns vary per tenant
              <img
                src={data.business.logoUrl}
                alt=""
                className="sabpay-checkout__logo"
              />
            ) : (
              <span className="sabpay-checkout__logo sabpay-checkout__logo--initial" aria-hidden="true">
                {brandInitial}
              </span>
            )}
            <span className="sabpay-checkout__merchant-name">{data.business.name}</span>
            {data.mode === 'test' ? (
              <span className="sabpay-checkout__test-badge">Test mode</span>
            ) : null}
          </div>

          <motion.p className="sabpay-checkout__amount" {...enter(0.06)}>
            {amountLabel}
          </motion.p>
          <motion.p className="sabpay-checkout__description" {...enter(0.1)}>
            {data.description}
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

        {/* ── Action panel ──────────────────────────────────────────── */}
        <section className="sabpay-checkout__panel" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {phase === 'form' && (
              <motion.form
                key="form"
                className="sabpay-checkout__form"
                onSubmit={payLive}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                <h1 className="sabpay-checkout__title">Complete your payment</h1>

                <div className="sabpay-checkout__field">
                  <label htmlFor="sp-name">Full name</label>
                  <input
                    id="sp-name"
                    name="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aarav Sharma"
                  />
                </div>

                <div className="sabpay-checkout__field">
                  <label htmlFor="sp-email">Email</label>
                  <input
                    id="sp-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="sabpay-checkout__field">
                  <label htmlFor="sp-phone">Mobile number</label>
                  <input
                    id="sp-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required={data.mode === 'live'}
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile"
                    aria-describedby={error ? 'sp-error' : undefined}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                {error ? (
                  <p id="sp-error" className="sabpay-checkout__error" role="alert">
                    {error}
                  </p>
                ) : null}

                {data.mode === 'live' ? (
                  <button type="submit" className="sabpay-checkout__pay">
                    Pay {amountLabel}
                  </button>
                ) : (
                  <div className="sabpay-checkout__simulate">
                    <p className="sabpay-checkout__simulate-note">
                      This is a test payment. Pick an outcome to exercise your
                      webhooks and redirect URLs; no money moves.
                    </p>
                    <button
                      type="button"
                      className="sabpay-checkout__pay"
                      onClick={() => simulate('success')}
                    >
                      Simulate successful payment
                    </button>
                    <button
                      type="button"
                      className="sabpay-checkout__pay sabpay-checkout__pay--ghost"
                      onClick={() => simulate('failure')}
                    >
                      Simulate failed payment
                    </button>
                  </div>
                )}

                <p className="sabpay-checkout__powered">
                  Powered by <strong>SabPay</strong>
                </p>
              </motion.form>
            )}

            {phase === 'processing' && (
              <motion.div
                key="processing"
                className="sabpay-checkout__state"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <span className="sabpay-checkout__spinner" aria-hidden="true" />
                <h1>Processing…</h1>
                <p>Hold tight, we're talking to the bank. Don't close this tab.</p>
              </motion.div>
            )}

            {phase === 'succeeded' && (
              <motion.div
                key="succeeded"
                className="sabpay-checkout__state"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              >
                <span className="sabpay-checkout__status-icon sabpay-checkout__status-icon--succeeded" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path className="sabpay-checkout__tick" d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <h1>Payment successful</h1>
                <p>
                  {amountLabel} paid to {data.business.name}.
                  {redirectUrl || data.successUrl
                    ? ' Taking you back to the store…'
                    : ' You can close this tab now.'}
                </p>
                <p className="sabpay-checkout__receipt-id">Ref: {data.paymentId}</p>
              </motion.div>
            )}

            {phase === 'failed' && (
              <motion.div
                key="failed"
                className="sabpay-checkout__state"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              >
                <span className="sabpay-checkout__status-icon sabpay-checkout__status-icon--failed" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </span>
                <h1>Payment didn't go through</h1>
                <p>
                  Nothing was charged.
                  {redirectUrl || data.cancelUrl
                    ? ' Taking you back to the store to retry…'
                    : ' Please return to the store and try again.'}
                </p>
                <p className="sabpay-checkout__receipt-id">Ref: {data.paymentId}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
