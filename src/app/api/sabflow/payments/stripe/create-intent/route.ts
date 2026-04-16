/**
 * SabFlow — Stripe Create PaymentIntent endpoint
 *
 * POST /api/sabflow/payments/stripe/create-intent
 *
 * Body:
 *   {
 *     flowId:       string  // owning flow id (for auditing / credential scope)
 *     sessionId:    string  // execution session id
 *     credentialId: string  // SabFlow stored credential id (type === 'stripe')
 *     amount:       string  // decimal amount ("9.99") — resolved by caller
 *     currency:     string  // 3-letter ISO, e.g. "USD"
 *     description?: string
 *     receiptEmail?: string
 *   }
 *
 * Response: { clientSecret, paymentIntentId, amount, currency }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCredentialById } from '@/lib/sabflow/credentials/db';
import { createPaymentIntent } from '@/lib/sabflow/payments/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COLLECTION = 'sabflow_sessions';

interface CreateIntentBody {
  flowId?: string;
  sessionId?: string;
  credentialId?: string;
  amount?: string;
  currency?: string;
  description?: string;
  receiptEmail?: string;
}

export async function POST(request: NextRequest) {
  let body: CreateIntentBody;
  try {
    body = (await request.json()) as CreateIntentBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { flowId, sessionId, credentialId, amount, currency, description, receiptEmail } = body;

  if (!flowId || typeof flowId !== 'string') {
    return NextResponse.json({ error: '`flowId` is required' }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: '`sessionId` is required' }, { status: 400 });
  }
  if (!credentialId || typeof credentialId !== 'string') {
    return NextResponse.json({ error: '`credentialId` is required' }, { status: 400 });
  }
  if (!amount || typeof amount !== 'string') {
    return NextResponse.json({ error: '`amount` is required' }, { status: 400 });
  }
  if (!currency || typeof currency !== 'string' || currency.length !== 3) {
    return NextResponse.json({ error: '`currency` must be a 3-letter ISO code' }, { status: 400 });
  }

  const numericAmount = Number.parseFloat(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const credential = await getCredentialById(credentialId);
    if (!credential || credential.type !== 'stripe') {
      return NextResponse.json({ error: 'Stripe credential not found' }, { status: 404 });
    }

    const secretKey = credential.data.secretKey;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe credential is missing a secret key' },
        { status: 422 },
      );
    }

    const intent = await createPaymentIntent({
      amount: numericAmount,
      currency,
      description,
      receiptEmail,
      secretKey,
      metadata: {
        sabflow_flow_id: flowId,
        sabflow_session_id: sessionId,
        sabflow_credential_id: credentialId,
      },
    });

    // Persist a marker on the session so the webhook can locate it later.
    if (ObjectId.isValid(sessionId)) {
      try {
        const { db } = await connectToDatabase();
        await db.collection(SESSION_COLLECTION).updateOne(
          { _id: new ObjectId(sessionId) },
          {
            $set: {
              _payment: {
                provider: 'stripe',
                paymentIntentId: intent.paymentIntentId,
                credentialId,
                amount: intent.amount,
                currency: intent.currency,
                status: 'pending',
                createdAt: new Date(),
              },
              updatedAt: new Date().toISOString(),
            },
          },
        );
      } catch (dbErr) {
        // Non-fatal — the intent is already live. Log and continue.
        console.error('[SABFLOW][stripe/create-intent] session update failed:', dbErr);
      }
    }

    return NextResponse.json({
      clientSecret: intent.clientSecret,
      paymentIntentId: intent.paymentIntentId,
      amount: intent.amount,
      currency: intent.currency,
      // The publishable key is safe to send to the browser — Stripe.js needs it
      // to confirm the PaymentIntent. Exposing it lets the client skip a
      // second round-trip just to read a public value.
      publishableKey: credential.data.publicKey,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW][stripe/create-intent] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
