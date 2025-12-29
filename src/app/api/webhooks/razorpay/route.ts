
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        console.error('RAZORPAY_WEBHOOK_SECRET is not set.');
        return NextResponse.json({ error: 'Internal server configuration error.' }, { status: 500 });
    }

    const signature = request.headers.get('x-razorpay-signature');
    const body = await request.text();

    try {
        const shasum = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET);
        shasum.update(body);
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        const event = JSON.parse(body);

        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const orderId = payment.order_id;
            
            const { db } = await connectToDatabase();
            
            const transaction = await db.collection('transactions').findOne({ providerOrderId: orderId });
            
            if (transaction) {
                // Update transaction status
                await db.collection('transactions').updateOne(
                    { _id: transaction._id },
                    { $set: { status: 'SUCCESS', providerPaymentId: payment.id, updatedAt: new Date() } }
                );

                // Add funds to user's wallet
                const amountToAdd = payment.amount; // amount is in smallest currency unit (paisa)
                await db.collection('users').updateOne(
                    { _id: transaction.userId },
                    {
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
                                createdAt: new Date()
                            }
                        }
                    }
                );

                console.log(`Successfully credited ${amountToAdd} to user ${transaction.userId} for order ${orderId}`);
            }
        }

        return NextResponse.json({ status: 'ok' });

    } catch (error: any) {
        console.error('Error processing Razorpay webhook:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
