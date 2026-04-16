/**
 * SabFlow — Stripe webhook endpoint
 *
 * POST /api/sabflow/payments/stripe/webhook
 *
 * Stripe hits this URL with JSON events.  The signing secret lives on the
 * Stripe credential record (data.webhookSecret).  We locate the credential
 * through the PaymentIntent's `sabflow_credential_id` metadata, which is set
 * when the intent is created in `create-intent/route.ts`.
 *
 * On `payment_intent.succeeded`, the matching SabFlow session's `_payment`
 * sub-document is flipped to `status: 'succeeded'`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
import { verifyStripeSignature } from '@/lib/sabflow/payments/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COLLECTION = 'sabflow_sessions';

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount?: number;
      currency?: string;
      status?: string;
      metadata?: Record<string, string>;
    };
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(rawBody) as StripeWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const paymentObject = event?.data?.object;
  if (!paymentObject || typeof paymentObject.id !== 'string') {
    return NextResponse.json({ error: 'Malformed event' }, { status: 400 });
  }

  const credentialId = paymentObject.metadata?.sabflow_credential_id;
  const sessionId = paymentObject.metadata?.sabflow_session_id;
  const flowId = paymentObject.metadata?.sabflow_flow_id;

  if (!credentialId) {
    // Not a SabFlow-originated intent — acknowledge and ignore.
    return NextResponse.json({ received: true, ignored: 'no credential metadata' });
  }

  try {
    const credential = await getCredentialById(credentialId);
    if (!credential || credential.type !== 'stripe') {
      return NextResponse.json({ error: 'Unknown credential' }, { status: 404 });
    }

    const webhookSecret = credential.data.webhookSecret;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Credential has no webhook secret configured' },
        { status: 422 },
      );
    }

    const verified = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Route by event type.
    switch (event.type) {
      case 'payment_intent.succeeded':
        await updateSessionPaymentStatus(sessionId, paymentObject.id, 'succeeded', {
          amount: paymentObject.amount,
          currency: paymentObject.currency,
          flowId,
        });
        break;
      case 'payment_intent.payment_failed':
        await updateSessionPaymentStatus(sessionId, paymentObject.id, 'failed', {
          flowId,
        });
        break;
      case 'payment_intent.canceled':
        await updateSessionPaymentStatus(sessionId, paymentObject.id, 'canceled', {
          flowId,
        });
        break;
      default:
        // Other event types are acknowledged but ignored.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error('[SABFLOW][stripe/webhook] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function updateSessionPaymentStatus(
  sessionId: string | undefined,
  paymentIntentId: string,
  status: 'succeeded' | 'failed' | 'canceled',
  extras: { amount?: number; currency?: string; flowId?: string },
): Promise<void> {
  if (!sessionId || !ObjectId.isValid(sessionId)) return;
  const { db } = await connectToDatabase();
  await db.collection(SESSION_COLLECTION).updateOne(
    { _id: new ObjectId(sessionId) },
    {
      $set: {
        '_payment.status': status,
        '_payment.paymentIntentId': paymentIntentId,
        '_payment.updatedAt': new Date(),
        ...(extras.amount !== undefined && { '_payment.amount': extras.amount }),
        ...(extras.currency && { '_payment.currency': extras.currency }),
        ...(extras.flowId && { '_payment.flowId': extras.flowId }),
        updatedAt: new Date().toISOString(),
      },
    },
  );
}
