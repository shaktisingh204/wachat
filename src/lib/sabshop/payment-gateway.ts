import 'server-only';

/**
 * SabShop — payment provider abstraction.
 *
 * `IPaymentGateway` is the surface every checkout payment integration
 * must implement (Razorpay, Stripe, Cashfree, mock, ...). The
 * storefront checkout flow only ever talks to this interface, so the
 * concrete provider can be swapped per-storefront / per-tenant without
 * touching the order or checkout flow.
 *
 * Pick the active gateway with {@link getPaymentGateway}. The default
 * implementation is {@link MockPaymentGateway} which immediately
 * succeeds — fine for local development and for tenants that have not
 * yet onboarded a real provider.
 */

export interface PaymentCustomer {
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface CreatePaymentIntentArgs {
  orderId: string;
  amount: number;
  currency: string;
  customer?: PaymentCustomer;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  /** Provider-specific intent id (e.g. Stripe pi_xxx, Razorpay order_xxx). */
  id: string;
  /** Where the storefront should POST the client-side confirmation. */
  clientSecret?: string;
  /** Optional redirect URL for hosted-checkout providers. */
  redirectUrl?: string;
  status: 'requires_payment' | 'pending' | 'succeeded' | 'failed';
  provider: string;
}

export interface ConfirmPaymentArgs {
  intentId: string;
  /** Provider-supplied signed payload that proves payment. */
  providerPayload?: Record<string, unknown>;
}

export interface ConfirmPaymentResult {
  ok: boolean;
  paymentRef?: string;
  status: 'succeeded' | 'failed' | 'pending';
  error?: string;
}

export interface RefundPaymentArgs {
  paymentRef: string;
  amount?: number;
  reason?: string;
}

export interface RefundPaymentResult {
  ok: boolean;
  refundId?: string;
  error?: string;
}

export interface IPaymentGateway {
  readonly providerId: string;
  createIntent(args: CreatePaymentIntentArgs): Promise<PaymentIntent>;
  confirm(args: ConfirmPaymentArgs): Promise<ConfirmPaymentResult>;
  refund(args: RefundPaymentArgs): Promise<RefundPaymentResult>;
}

/** Always succeeds. Useful for local dev and for storefronts with no provider. */
export class MockPaymentGateway implements IPaymentGateway {
  readonly providerId = 'mock';

  async createIntent(args: CreatePaymentIntentArgs): Promise<PaymentIntent> {
    return {
      id: `mock_intent_${args.orderId}_${Date.now()}`,
      clientSecret: 'mock_secret',
      status: 'requires_payment',
      provider: this.providerId,
    };
  }

  async confirm(args: ConfirmPaymentArgs): Promise<ConfirmPaymentResult> {
    return {
      ok: true,
      paymentRef: `mock_pay_${args.intentId}`,
      status: 'succeeded',
    };
  }

  async refund(args: RefundPaymentArgs): Promise<RefundPaymentResult> {
    return {
      ok: true,
      refundId: `mock_refund_${args.paymentRef}_${Date.now()}`,
    };
  }
}

/**
 * Resolve the active payment gateway. Today this just returns the
 * mock; once concrete provider impls land they can be selected by the
 * storefront's `paymentProvider` field.
 *
 * TODO(commerce): wire Razorpay/Stripe/Cashfree implementations and
 * select per `storefront.paymentProvider`.
 */
export function getPaymentGateway(_providerId?: string): IPaymentGateway {
  return new MockPaymentGateway();
}
