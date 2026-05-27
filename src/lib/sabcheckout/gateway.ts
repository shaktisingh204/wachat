import 'server-only';

/**
 * SabCheckout payment-gateway abstraction.
 *
 * Defines the contract every concrete provider (Razorpay, Stripe,
 * Cashfree, …) must implement to plug into the SabCheckout admin +
 * public flow. The Next.js layer (server actions in
 * `src/app/actions/sabcheckout*.actions.ts`) is the only thing that
 * talks to gateways — Rust crates store records only.
 *
 * ## Lifecycle
 *
 * 1. **`createSession(args)`** — called from the public payment page
 *    when the payer submits the form. The gateway returns either a
 *    `redirectUrl` (gateway-hosted checkout) or `clientPayload`
 *    (inline/JS-SDK style). The Rust `sabcheckout_sessions` record is
 *    created first; this call stamps `providerSessionId` on it.
 * 2. **`confirmSession(args)`** — called from the gateway return /
 *    webhook path. Maps the gateway's terminal status into our
 *    canonical `'completed' | 'failed' | 'expired'`.
 * 3. **`cancelSubscription(args)`** — admin-triggered from the
 *    subscriptions table.
 *
 * Concrete provider implementations are deferred — the default export
 * is {@link MockGateway} which always returns a "completed" status with
 * a deterministic fake `paymentRef`, suitable for local dev + tests.
 */

import type {
  SabcheckoutSelectedItem,
  SabcheckoutSessionStatus,
  SabcheckoutSessionTotals,
} from '@/lib/rust-client/sabcheckout-sessions';

/* ─── Args + result types ─────────────────────────────────────────── */

export interface GatewayCreateSessionArgs {
  /** SabCheckout session id (`sabcheckout_sessions._id` hex). */
  sessionId: string;
  /** Tenant root — the page owner's userId. */
  userId: string;
  /** Slug of the page that initiated the session. */
  pageSlug: string;
  /** Stable URL the gateway should redirect back to on success. */
  successUrl: string;
  /** Stable URL the gateway should redirect back to on cancel. */
  cancelUrl: string;
  payer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  totals: SabcheckoutSessionTotals;
  selectedItems: SabcheckoutSelectedItem[];
  /** Set when the payer is subscribing to a plan. */
  planId?: string;
  /** Free-form notes/passthrough metadata. */
  metadata?: Record<string, string>;
}

export interface GatewayCreateSessionResult {
  /** Provider-side id, persisted on the SabCheckout session. */
  providerSessionId: string;
  /**
   * Where to send the browser next. Either a hosted-redirect URL or a
   * client payload the front end uses to mount the gateway widget.
   */
  redirectUrl?: string;
  clientPayload?: Record<string, unknown>;
}

export interface GatewayConfirmSessionArgs {
  /** SabCheckout session id (hex). */
  sessionId: string;
  /** Whatever query/body the gateway-return route received. */
  payload: Record<string, unknown>;
}

export interface GatewayConfirmSessionResult {
  status: SabcheckoutSessionStatus;
  /** Opaque, provider-specific payment reference. */
  paymentRef?: string;
  /** Provider customer id for recurring flows. */
  externalCustomerRef?: string;
  /** Provider subscription id for recurring flows. */
  providerSubscriptionId?: string;
}

export interface GatewayCancelSubscriptionArgs {
  subscriptionId: string;
  providerSubscriptionId?: string;
}

export interface GatewayCancelSubscriptionResult {
  cancelled: boolean;
}

/* ─── Interface ───────────────────────────────────────────────────── */

export interface ICheckoutGateway {
  /** Human-readable provider name (`'mock'`, `'razorpay'`, …). */
  readonly name: string;
  createSession(
    args: GatewayCreateSessionArgs,
  ): Promise<GatewayCreateSessionResult>;
  confirmSession(
    args: GatewayConfirmSessionArgs,
  ): Promise<GatewayConfirmSessionResult>;
  cancelSubscription(
    args: GatewayCancelSubscriptionArgs,
  ): Promise<GatewayCancelSubscriptionResult>;
}

/* ─── Default impl: MockGateway ───────────────────────────────────── */

/**
 * Dev/test gateway. Returns deterministic fake ids so the public flow
 * works end-to-end without external network calls.
 *
 * `createSession` returns a `redirectUrl` pointing back to the success
 * page with `?mock=1&session=<id>` so the success route can call
 * `confirmSession` and flip the record to `completed`.
 */
export class MockGateway implements ICheckoutGateway {
  public readonly name = 'mock';

  async createSession(
    args: GatewayCreateSessionArgs,
  ): Promise<GatewayCreateSessionResult> {
    const providerSessionId = `mock_sess_${args.sessionId}`;
    const url = new URL(args.successUrl);
    url.searchParams.set('mock', '1');
    url.searchParams.set('sessionId', args.sessionId);
    return {
      providerSessionId,
      redirectUrl: url.toString(),
    };
  }

  async confirmSession(
    args: GatewayConfirmSessionArgs,
  ): Promise<GatewayConfirmSessionResult> {
    return {
      status: 'completed',
      paymentRef: `mock_pay_${args.sessionId}`,
    };
  }

  async cancelSubscription(
    _args: GatewayCancelSubscriptionArgs,
  ): Promise<GatewayCancelSubscriptionResult> {
    return { cancelled: true };
  }
}

/* ─── Resolver ────────────────────────────────────────────────────── */

let cachedGateway: ICheckoutGateway | null = null;

/**
 * Resolve the configured gateway. Today this always returns
 * {@link MockGateway}; once a concrete provider lands, dispatch on
 * `process.env.SABCHECKOUT_GATEWAY` (e.g. `'razorpay' | 'stripe'`).
 *
 * TODO: wire Razorpay / Stripe / Cashfree implementations.
 */
export function getCheckoutGateway(): ICheckoutGateway {
  if (cachedGateway) return cachedGateway;
  cachedGateway = new MockGateway();
  return cachedGateway;
}
