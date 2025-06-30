
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getPaymentGatewaySettings } from '@/app/actions';
import { createHash } from 'crypto';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const base64Response = body.response;
        if (!base64Response) {
            console.error('PhonePe callback error: No response property in body');
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const pgSettings = await getPaymentGatewaySettings();

        if (!pgSettings?.saltKey || !pgSettings.saltIndex) {
            console.error('PhonePe callback error: Salt key or index not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        
        const receivedChecksum = request.headers.get('x-verify');
        const calculatedChecksum = createHash('sha256').update(base64Response + pgSettings.saltKey).digest('hex') + '###' + pgSettings.saltIndex;

        if (receivedChecksum !== calculatedChecksum) {
            console.error('PhonePe callback error: Checksum mismatch');
            return NextResponse.json({ error: 'Checksum mismatch' }, { status: 400 });
        }
        
        const decodedPayload = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf-8'));
        const { merchantTransactionId, code: paymentStatus } = decodedPayload;

        if (!merchantTransactionId) {
            console.error('PhonePe callback error: merchantTransactionId not found in payload');
            return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
        }

        const transaction = await db.collection('transactions').findOne({ _id: new ObjectId(merchantTransactionId) });
        if (!transaction) {
            console.error(`PhonePe callback error: Transaction ${merchantTransactionId} not found`);
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.status !== 'PENDING') {
            return NextResponse.json({ message: 'Transaction already processed' });
        }
        
        const updateFields: any = {
            status: paymentStatus === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'FAILED',
            providerTransactionId: decodedPayload.providerTransactionId || decodedPayload.transactionId,
            updatedAt: new Date()
        };

        if (paymentStatus === 'PAYMENT_SUCCESS') {
            await db.collection('users').updateOne(
                { _id: transaction.userId },
                { $set: { planId: transaction.planId } }
            );
        }
        
        await db.collection('transactions').updateOne(
            { _id: transaction._id },
            { $set: updateFields }
        );

        revalidatePath('/dashboard/billing');
        revalidatePath('/dashboard', 'layout');

        return NextResponse.json({ success: true, message: 'Callback processed' });

    } catch (error: any) {
        console.error('PhonePe callback processing failed:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
