'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { LuCreditCard, LuLock, LuLoader, LuCheck } from 'react-icons/lu';
import type { PaymentInputOptions } from '@/lib/sabflow/types';

/* ── Stripe.js global declaration ───────────────────────────────────────── */

interface StripeElementsInstance {
  create: (type: 'payment', options?: Record<string, unknown>) => StripePaymentElement;
}
interface StripePaymentElement {
  mount: (el: HTMLElement) => void;
  unmount: () => void;
  destroy: () => void;
}
interface StripeConfirmPaymentParams {
  elements: StripeElementsInstance;
  confirmParams?: Record<string, unknown>;
  redirect?: 'if_required' | 'always';
}
interface StripeConfirmPaymentResult {
  error?: { message?: string; type?: string };
  paymentIntent?: { id: string; status: string };
}
interface StripeInstance {
  elements: (opts: { clientSecret: string; appearance?: Record<string, unknown> }) => StripeElementsInstance;
  confirmPayment: (params: StripeConfirmPaymentParams) => Promise<StripeConfirmPaymentResult>;
}
type StripeLoader = (publishableKey: string) => StripeInstance;

declare global {
  interface Window {
    Stripe?: StripeLoader;
  }
}

/* ── Script loader — loaded lazily on first mount ───────────────────────── */

let stripeScriptPromise: Promise<void> | null = null;

function loadStripeScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Stripe) return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  stripeScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3/"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });

  return stripeScriptPromise;
}

/* ── Customer info form state ───────────────────────────────────────────── */

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  country: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

const EMPTY_INFO: CustomerInfo = {
  name: '',
  email: '',
  phone: '',
  country: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

/* ── Props ──────────────────────────────────────────────────────────────── */

interface PaymentBlockProps {
  options: PaymentInputOptions;
  flowId: string;
  sessionId: string;
  /** Resolved amount (with {{variables}} substituted) — string decimal. */
  resolvedAmount: string;
  /** Resolved button label — {{amount}} already substituted. */
  resolvedButtonLabel: string;
  /** Called with a summary string once the payment succeeds. */
  onComplete: (summary: string) => void;
  /** Visual theme colours forwarded from ChatWindow. */
  buttonBg: string;
  buttonColor: string;
  bubbleBg: string;
  bubbleColor: string;
}

/* ── UI helper ──────────────────────────────────────────────────────────── */

function inputClass(): string {
  return 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-black/30 transition-colors dark:bg-white/5 dark:text-white dark:border-white/10';
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function PaymentBlock({
  options,
  flowId,
  sessionId,
  resolvedAmount,
  resolvedButtonLabel,
  onComplete,
  buttonBg,
  buttonColor,
  bubbleBg,
  bubbleColor,
}: PaymentBlockProps) {
  type Phase = 'idle' | 'collecting' | 'loading' | 'ready' | 'confirming' | 'success' | 'error';

  const info = options.additionalInformation ?? {};
  const needsName = Boolean(info.name);
  const needsEmail = Boolean(info.email);
  const needsPhone = Boolean(info.phoneNumber);
  const needsAddress = Boolean(info.address);
  const needsCustomerForm = needsName || needsEmail || needsPhone || needsAddress;

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_INFO);

  const stripeRef = useRef<StripeInstance | null>(null);
  const elementsRef = useRef<StripeElementsInstance | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const elementsContainerRef = useRef<HTMLDivElement>(null);
  const clientSecretRef = useRef<string | null>(null);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      try {
        paymentElementRef.current?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ── Request a PaymentIntent, mount Stripe Elements ────── */
  const beginPayment = useCallback(async () => {
    setErrorMessage(null);
    setPhase('loading');

    try {
      if (!options.credentialId) {
        throw new Error('This payment block is not configured with a credential.');
      }

      const response = await fetch('/api/sabflow/payments/stripe/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          flowId,
          sessionId,
          credentialId: options.credentialId,
          amount: resolvedAmount,
          currency: options.currency ?? 'USD',
          description: options.description,
          receiptEmail: needsEmail ? customer.email : undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Payment setup failed (${response.status})`);
      }

      const { clientSecret, publishableKey: pk } = (await response.json()) as {
        clientSecret: string;
        paymentIntentId: string;
        publishableKey?: string;
      };

      if (!pk) {
        throw new Error('Stripe credential is missing a publishable key.');
      }

      clientSecretRef.current = clientSecret;

      await loadStripeScript();
      if (!window.Stripe) throw new Error('Stripe.js failed to initialise.');

      const stripe = window.Stripe(pk);
      stripeRef.current = stripe;

      const elements = stripe.elements({ clientSecret });
      elementsRef.current = elements;

      const paymentElement = elements.create('payment', {
        layout: { type: 'tabs', defaultCollapsed: false },
      });
      paymentElementRef.current = paymentElement;

      setPhase('ready');

      // Mount on next tick so the container div has rendered.
      requestAnimationFrame(() => {
        if (elementsContainerRef.current) {
          paymentElement.mount(elementsContainerRef.current);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start payment.';
      setErrorMessage(msg);
      setPhase('error');
    }
  }, [
    options.credentialId,
    options.currency,
    options.description,
    flowId,
    sessionId,
    resolvedAmount,
    needsEmail,
    customer.email,
  ]);

  /* ── Confirm via Stripe.js ─────────────────────────────── */
  const confirmPayment = useCallback(async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setErrorMessage(null);
    setPhase('confirming');

    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: window.location.href,
          ...(needsEmail && customer.email && { receipt_email: customer.email }),
          ...(needsName || needsEmail || needsPhone || needsAddress
            ? {
                payment_method_data: {
                  billing_details: {
                    ...(needsName && { name: customer.name }),
                    ...(needsEmail && { email: customer.email }),
                    ...(needsPhone && { phone: customer.phone }),
                    ...(needsAddress && {
                      address: {
                        country: customer.country || undefined,
                        line1: customer.line1 || undefined,
                        line2: customer.line2 || undefined,
                        city: customer.city || undefined,
                        state: customer.state || undefined,
                        postal_code: customer.postalCode || undefined,
                      },
                    }),
                  },
                },
              }
            : {}),
        },
        redirect: 'if_required',
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Payment failed.');
      }

      const pi = result.paymentIntent;
      if (pi && (pi.status === 'succeeded' || pi.status === 'processing')) {
        setPhase('success');
        onComplete(`payment:${pi.id}:${pi.status}`);
      } else {
        throw new Error(`Unexpected payment status: ${pi?.status ?? 'unknown'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed.';
      setErrorMessage(msg);
      setPhase('error');
    }
  }, [customer, needsAddress, needsEmail, needsName, needsPhone, onComplete]);

  /* ── Customer info form submit handler ─────────────────── */
  const handleInfoSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void beginPayment();
  };

  const startButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => {
          if (needsCustomerForm) {
            setPhase('collecting');
          } else {
            void beginPayment();
          }
        }}
        className="flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-95"
        style={{ backgroundColor: buttonBg, color: buttonColor }}
      >
        <LuCreditCard className="h-4 w-4" strokeWidth={2} />
        {resolvedButtonLabel}
      </button>
    ),
    [beginPayment, buttonBg, buttonColor, needsCustomerForm, resolvedButtonLabel],
  );

  /* ── Phase renderers ───────────────────────────────────── */

  if (phase === 'success') {
    return (
      <div className="flex justify-start py-1">
        <div
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13.5px] shadow-sm"
          style={{ backgroundColor: bubbleBg, color: bubbleColor }}
        >
          <LuCheck className="h-4 w-4 shrink-0" strokeWidth={2.5} style={{ color: buttonBg }} />
          <span>{options.labels?.success ?? 'Payment successful!'}</span>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-start gap-1.5 py-1">
        {startButton}
        <div className="flex items-center gap-1 text-[10.5px]" style={{ color: 'var(--gray-8)' }}>
          <LuLock className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span>Secure payment via Stripe</span>
        </div>
      </div>
    );
  }

  if (phase === 'collecting') {
    return (
      <form
        onSubmit={handleInfoSubmit}
        className="flex max-w-[92%] flex-col gap-2 self-start rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
        style={{ backgroundColor: bubbleBg, color: bubbleColor }}
      >
        <p className="text-[12px] font-medium opacity-80">Your details</p>

        {needsName && (
          <input
            type="text"
            required
            value={customer.name}
            onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
            placeholder="Full name"
            className={inputClass()}
            autoComplete="name"
          />
        )}
        {needsEmail && (
          <input
            type="email"
            required
            value={customer.email}
            onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
            placeholder="Email"
            className={inputClass()}
            autoComplete="email"
          />
        )}
        {needsPhone && (
          <input
            type="tel"
            required
            value={customer.phone}
            onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
            placeholder="Phone"
            className={inputClass()}
            autoComplete="tel"
          />
        )}

        {needsAddress && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={customer.country}
              onChange={(e) => setCustomer((c) => ({ ...c, country: e.target.value }))}
              placeholder="Country"
              className={inputClass()}
              autoComplete="country"
            />
            <input
              type="text"
              value={customer.line1}
              onChange={(e) => setCustomer((c) => ({ ...c, line1: e.target.value }))}
              placeholder="Address line 1"
              className={inputClass()}
              autoComplete="address-line1"
            />
            <input
              type="text"
              value={customer.line2}
              onChange={(e) => setCustomer((c) => ({ ...c, line2: e.target.value }))}
              placeholder="Address line 2"
              className={inputClass()}
              autoComplete="address-line2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customer.city}
                onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))}
                placeholder="City"
                className={inputClass()}
              />
              <input
                type="text"
                value={customer.state}
                onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value }))}
                placeholder="State"
                className={inputClass()}
              />
            </div>
            <input
              type="text"
              value={customer.postalCode}
              onChange={(e) => setCustomer((c) => ({ ...c, postalCode: e.target.value }))}
              placeholder="Postal code"
              className={inputClass()}
              autoComplete="postal-code"
            />
          </div>
        )}

        <button
          type="submit"
          className="mt-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-95"
          style={{ backgroundColor: buttonBg, color: buttonColor }}
        >
          <LuCreditCard className="h-4 w-4" strokeWidth={2} />
          Continue
        </button>
      </form>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-2 self-start py-2 text-[13px]" style={{ color: 'var(--gray-9)' }}>
        <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        <span>Preparing secure checkout…</span>
      </div>
    );
  }

  if (phase === 'ready' || phase === 'confirming') {
    const isConfirming = phase === 'confirming';
    return (
      <div
        className="flex max-w-[92%] flex-col gap-3 self-start rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
        style={{ backgroundColor: bubbleBg, color: bubbleColor }}
      >
        <div ref={elementsContainerRef} className="rounded-lg bg-white p-2 dark:bg-white/5" />

        {errorMessage && (
          <p className="text-[11.5px] text-red-500">{errorMessage}</p>
        )}

        <button
          type="button"
          onClick={() => void confirmPayment()}
          disabled={isConfirming}
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: buttonBg, color: buttonColor }}
        >
          {isConfirming ? (
            <>
              <LuLoader className="h-4 w-4 animate-spin" strokeWidth={2} />
              Processing…
            </>
          ) : (
            <>
              <LuLock className="h-4 w-4" strokeWidth={2} />
              {resolvedButtonLabel}
            </>
          )}
        </button>

        <p className="flex items-center gap-1 text-[10.5px] opacity-70">
          <LuLock className="h-2.5 w-2.5" strokeWidth={2.5} />
          Payments are encrypted end-to-end and processed by Stripe.
        </p>
      </div>
    );
  }

  // phase === 'error'
  return (
    <div className="flex flex-col items-start gap-2 py-1">
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]"
        style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#b91c1c' }}
      >
        <span>{errorMessage ?? 'Payment failed. Please try again.'}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setPhase('idle');
          setErrorMessage(null);
        }}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: buttonBg, color: buttonColor }}
      >
        <LuCreditCard className="h-4 w-4" strokeWidth={2} />
        Try again
      </button>
    </div>
  );
}
