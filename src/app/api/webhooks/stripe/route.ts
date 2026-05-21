import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { recordGatewayPaymentByHash } from '@/app/actions/public-invoice.actions';

/**
 * Stripe webhook — multi-tenant invoice checkout.
 *
 * We don't have a single shared `STRIPE_WEBHOOK_SECRET` because each
 * tenant brings its own keys via `crm_payment_gateway_credentials`.
 * To pick the right secret we look at the `stripe-signature` header,
 * parse the event without verifying first, find the tenant from
 * `metadata.tenantId`, load that tenant's `webhook_secret`, then
 * verify the signature properly. If verification fails we return 400.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Pre-parse to find the tenant; verification is below.
    event = JSON.parse(rawBody) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Best effort: read invoice metadata from the payload to find the tenant.
  const obj = event?.data?.object as Record<string, unknown> | undefined;
  const metadata = (obj?.metadata as Record<string, string> | undefined) || {};
  const tenantId = metadata.tenantId;
  if (!tenantId || !ObjectId.isValid(tenantId)) {
    // Not one of ours — accept silently to avoid Stripe retries.
    return NextResponse.json({ status: 'ignored' });
  }

  const { db } = await connectToDatabase();
  const cred = await db.collection('crm_payment_gateway_credentials').findOne({
    userId: new ObjectId(tenantId),
    gateway: 'stripe',
  });
  if (!cred) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 400 });
  }

  const apiSecret = (cred as Record<string, string>).api_secret;
  const webhookSecret = (cred as Record<string, string>).webhook_secret;
  if (!apiSecret || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook secret not configured for tenant.' },
      { status: 400 },
    );
  }

  const stripe = new Stripe(apiSecret);
  let verified: Stripe.Event;
  try {
    verified = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error('[stripe-webhook] signature verification failed:', e);
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  try {
    if (verified.type === 'checkout.session.completed') {
      const session = verified.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const invoiceId = meta.invoiceId;
      const invoiceHash = meta.invoiceHash;
      const amount = session.amount_total != null ? session.amount_total / 100 : 0;
      const currency = (session.currency || 'usd').toUpperCase();
      const transactionId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || session.id;

      if (amount > 0 && (invoiceId || invoiceHash)) {
        await recordGatewayPaymentByHash({
          hash: invoiceHash,
          invoiceId,
          amount,
          currency,
          gateway: 'stripe',
          transactionId,
          remarks: `Stripe session ${session.id}`,
        });
      }
    } else if (verified.type === 'checkout.session.async_payment_failed') {
      const session = verified.data.object as Stripe.Checkout.Session;
      console.warn('[stripe-webhook] async payment failed:', session.id);
    }
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('[stripe-webhook] handler failed:', e);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}
