'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { CreditCard, Lock, Check } from 'lucide-react';
import { Button, Field, Input, Spinner, Alert } from '@/components/sabcrm/20ui';
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

/* ── Script loader: loaded lazily on first mount ────────────────────────── */

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
  /** Resolved amount (with {{variables}} substituted), string decimal. */
  resolvedAmount: string;
  /** Resolved button label, {{amount}} already substituted. */
  resolvedButtonLabel: string;
  /** Called with a summary string once the payment succeeds. */
  onComplete: (summary: string) => void;
  /** Visual theme colours forwarded from ChatWindow. */
  buttonBg: string;
  buttonColor: string;
  bubbleBg: string;
  bubbleColor: string;
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
      <Button
        type="button"
        iconLeft={CreditCard}
        onClick={() => {
          if (needsCustomerForm) {
            setPhase('collecting');
          } else {
            void beginPayment();
          }
        }}
        className="active:scale-95"
        style={{ backgroundColor: buttonBg, color: buttonColor, borderColor: 'transparent' }}
      >
        {resolvedButtonLabel}
      </Button>
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
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} style={{ color: buttonBg }} aria-hidden="true" />
          <span>{options.labels?.success ?? 'Payment successful!'}</span>
        </div>
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-start gap-1.5 py-1">
        {startButton}
        <div className="flex items-center gap-1 text-[10.5px] text-[var(--st-text-tertiary)]">
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
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
          <Field label="Full name" required>
            <Input
              type="text"
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
              placeholder="Jane Cooper"
              autoComplete="name"
            />
          </Field>
        )}
        {needsEmail && (
          <Field label="Email" required>
            <Input
              type="email"
              value={customer.email}
              onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
              placeholder="jane@example.com"
              autoComplete="email"
            />
          </Field>
        )}
        {needsPhone && (
          <Field label="Phone" required>
            <Input
              type="tel"
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
            />
          </Field>
        )}

        {needsAddress && (
          <div className="flex flex-col gap-2">
            <Field label="Country">
              <Input
                type="text"
                value={customer.country}
                onChange={(e) => setCustomer((c) => ({ ...c, country: e.target.value }))}
                placeholder="United States"
                autoComplete="country"
              />
            </Field>
            <Field label="Address line 1">
              <Input
                type="text"
                value={customer.line1}
                onChange={(e) => setCustomer((c) => ({ ...c, line1: e.target.value }))}
                placeholder="123 Market Street"
                autoComplete="address-line1"
              />
            </Field>
            <Field label="Address line 2">
              <Input
                type="text"
                value={customer.line2}
                onChange={(e) => setCustomer((c) => ({ ...c, line2: e.target.value }))}
                placeholder="Suite 400"
                autoComplete="address-line2"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="City">
                <Input
                  type="text"
                  value={customer.city}
                  onChange={(e) => setCustomer((c) => ({ ...c, city: e.target.value }))}
                  placeholder="San Francisco"
                />
              </Field>
              <Field label="State">
                <Input
                  type="text"
                  value={customer.state}
                  onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value }))}
                  placeholder="CA"
                />
              </Field>
            </div>
            <Field label="Postal code">
              <Input
                type="text"
                value={customer.postalCode}
                onChange={(e) => setCustomer((c) => ({ ...c, postalCode: e.target.value }))}
                placeholder="94103"
                autoComplete="postal-code"
              />
            </Field>
          </div>
        )}

        <Button
          type="submit"
          block
          iconLeft={CreditCard}
          className="mt-1 active:scale-95"
          style={{ backgroundColor: buttonBg, color: buttonColor, borderColor: 'transparent' }}
        >
          Continue
        </Button>
      </form>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center gap-2 self-start py-2 text-[13px] text-[var(--st-text-secondary)]">
        <Spinner size="sm" label="Preparing checkout" />
        <span>Preparing secure checkout.</span>
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
        <div ref={elementsContainerRef} className="rounded-[var(--st-radius)] bg-[var(--st-bg)] p-2" />

        {errorMessage && (
          <Alert tone="danger" className="text-[11.5px]">
            {errorMessage}
          </Alert>
        )}

        <Button
          type="button"
          block
          loading={isConfirming}
          iconLeft={isConfirming ? undefined : Lock}
          onClick={() => void confirmPayment()}
          className="active:scale-95"
          style={{ backgroundColor: buttonBg, color: buttonColor, borderColor: 'transparent' }}
        >
          {isConfirming ? 'Processing.' : resolvedButtonLabel}
        </Button>

        <p className="flex items-center gap-1 text-[10.5px] opacity-70">
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
          Payments are encrypted end-to-end and processed by Stripe.
        </p>
      </div>
    );
  }

  // phase === 'error'
  return (
    <div className="flex flex-col items-start gap-2 py-1">
      <Alert tone="danger" className="text-[12.5px]">
        {errorMessage ?? 'Payment failed. Please try again.'}
      </Alert>
      <Button
        type="button"
        iconLeft={CreditCard}
        onClick={() => {
          setPhase('idle');
          setErrorMessage(null);
        }}
        style={{ backgroundColor: buttonBg, color: buttonColor, borderColor: 'transparent' }}
      >
        Try again
      </Button>
    </div>
  );
}
