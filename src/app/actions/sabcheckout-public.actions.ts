'use server';

/**
 * SabCheckout PUBLIC server actions — driven by the unauthenticated
 * `/pay/[pageSlug]` route. Every action here intentionally skips the
 * session check; tenant binding is established server-side by the Rust
 * `sabcheckout-sessions` public handler (which resolves the page by
 * slug and stamps the page's `userId` onto the new session).
 *
 * Flow:
 *   1. `loadPublicSabcheckoutPage(slug)`   → renders `/pay/[slug]`.
 *   2. `createSabcheckoutSession({ … })`   → writes pending session +
 *      asks the configured `ICheckoutGateway` to create a provider
 *      session, returning `redirectUrl` for the browser.
 *   3. `confirmSabcheckoutSession({ … })`  → called from the success
 *      route to flip the session to `completed`/`failed`.
 */

import {
  sabcheckoutPagesApi,
  type SabcheckoutPagePublicView,
} from '@/lib/rust-client/sabcheckout-pages';
import {
  sabcheckoutSessionsApi,
  type SabcheckoutPublicCreateSessionInput,
  type SabcheckoutSessionDoc,
} from '@/lib/rust-client/sabcheckout-sessions';
import { getCheckoutGateway } from '@/lib/sabcheckout/gateway';

export async function loadPublicSabcheckoutPage(
  slug: string,
): Promise<
  | { ok: true; data: SabcheckoutPagePublicView }
  | { ok: false; error: string }
> {
  try {
    const data = await sabcheckoutPagesApi.publicGetBySlug(slug);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createSabcheckoutSession(
  input: SabcheckoutPublicCreateSessionInput,
): Promise<
  | {
      ok: true;
      sessionId: string;
      redirectUrl?: string;
      session: SabcheckoutSessionDoc;
    }
  | { ok: false; error: string }
> {
  try {
    // 1. Create a pending session in our store.
    const created = await sabcheckoutSessionsApi.publicCreate(input);
    const sessionId = created.id;
    const session = created.session;

    // 2. Resolve gateway + ask it to create its own session.
    const gateway = getCheckoutGateway();

    // Stable return URLs for the payer's browser. Concrete provider
    // URLs are computed via the page's success/cancel; in dev with
    // MockGateway we just bounce back to /pay/[slug]/success.
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://localhost:3000';
    const successUrl = `${origin}/pay/${encodeURIComponent(input.pageSlug)}/success`;
    const cancelUrl = `${origin}/pay/${encodeURIComponent(input.pageSlug)}/cancel`;

    const gwResult = await gateway.createSession({
      sessionId,
      userId: session.userId,
      pageSlug: input.pageSlug,
      successUrl,
      cancelUrl,
      payer: {
        email: input.payerEmail,
        name: input.payerName,
        phone: input.payerPhone,
      },
      totals: input.totals,
      selectedItems: input.selectedItems,
    });

    return {
      ok: true,
      sessionId,
      redirectUrl: gwResult.redirectUrl,
      session,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function confirmSabcheckoutSession(args: {
  sessionId: string;
  /** Free-form gateway payload (query/body) from the return URL. */
  payload?: Record<string, unknown>;
}): Promise<
  { ok: true; session: SabcheckoutSessionDoc } | { ok: false; error: string }
> {
  try {
    const gateway = getCheckoutGateway();
    const result = await gateway.confirmSession({
      sessionId: args.sessionId,
      payload: args.payload ?? {},
    });
    const { session } = await sabcheckoutSessionsApi.publicConfirm({
      sessionId: args.sessionId,
      status: result.status,
      paymentRef: result.paymentRef,
    });
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
