import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { recordGatewayPaymentByHash } from '@/app/actions/public-invoice.actions';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/**
 * Razorpay webhook — handles two flows:
 *
 *  1. Wallet top-up (legacy) — matches a row in `transactions` by
 *     `providerOrderId` and credits the user wallet.
 *  2. Public invoice checkout — order created by `startGatewayCheckout`
 *     carries `notes.invoiceId` / `notes.invoiceHash`, which we use to
 *     record a `crm_payments` row via `recordGatewayPaymentByHash`.
 *
 * Verification: We first try the platform-level `RAZORPAY_WEBHOOK_SECRET`
 * for the wallet flow. If that fails, we look up the tenant from the
 * order notes and verify with the tenant's `webhook_secret` instead.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature') || '';
  const body = await request.text();

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: Record<string, unknown> & {
          order_id?: string;
          id?: string;
          amount?: number;
          currency?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  const notes = (payment?.notes || {}) as Record<string, string>;
  const tenantId = notes.tenantId;

  // Pick a webhook secret based on the flow.
  let webhookSecret: string | null = RAZORPAY_WEBHOOK_SECRET || null;
  if (tenantId && ObjectId.isValid(tenantId)) {
    try {
      const { db } = await connectToDatabase();
      const cred = await db.collection('crm_payment_gateway_credentials').findOne({
        userId: new ObjectId(tenantId),
        gateway: 'razorpay',
      });
      const ws = (cred as Record<string, string> | null)?.webhook_secret;
      if (ws) webhookSecret = ws;
    } catch (e) {
      console.warn('[razorpay-webhook] tenant cred lookup failed:', e);
    }
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured.' },
      { status: 500 },
    );
  }

  const digest = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  if (digest !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.event === 'payment.captured' && payment) {
      const orderId = payment.order_id;
      const { db } = await connectToDatabase();

      // 1. Invoice flow — `notes` carry the tenant + invoice
      if (notes.invoiceId || notes.invoiceHash) {
        const amount = (payment.amount || 0) / 100;
        const currency = (payment.currency || 'INR').toUpperCase();
        await recordGatewayPaymentByHash({
          hash: notes.invoiceHash,
          invoiceId: notes.invoiceId,
          amount,
          currency,
          gateway: 'razorpay',
          transactionId: payment.id || '',
          remarks: `Razorpay order ${orderId || ''}`.trim(),
        });
        return NextResponse.json({ status: 'ok' });
      }

      // 2. Wallet top-up — legacy path
      if (orderId) {
        const transaction = await db
          .collection('transactions')
          .findOne({ providerOrderId: orderId });

        if (transaction) {
          await db.collection('transactions').updateOne(
            { _id: transaction._id },
            {
              $set: {
                status: 'SUCCESS',
                providerPaymentId: payment.id,
                updatedAt: new Date(),
              },
            },
          );

          const amountToAdd = payment.amount || 0;
          const walletUpdate: Record<string, unknown> = {
            $inc: { 'wallet.balance': amountToAdd },
            $push: {
              'wallet.transactions': {
                _id: new ObjectId(),
                type: 'CREDIT',
                amount: amountToAdd,
                reason: 'Added funds via Razorpay',
                razorpayOrderId: orderId,
                razorpayPaymentId: payment.id,
                status: 'SUCCESS',
                createdAt: new Date(),
              },
            },
          };
          await db
            .collection('users')
            .updateOne({ _id: transaction.userId }, walletUpdate as never);

          console.log(
            `Successfully credited ${amountToAdd} to user ${transaction.userId} for order ${orderId}`,
          );
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook error' },
      { status: 500 },
    );
  }
}
