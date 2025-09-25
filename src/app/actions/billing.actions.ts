
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import type { PaymentGatewaySettings, Transaction, Plan } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { headers } from 'next/headers';

export async function getPaymentGatewaySettings(): Promise<WithId<PaymentGatewaySettings> | null> {
    try {
        const { db } = await connectToDatabase();
        const settings = await db.collection('payment_gateway_settings').findOne({ _id: 'phonepe' });
        return settings ? JSON.parse(JSON.stringify(settings)) : null;
    } catch(e) {
        return null;
    }
}

export async function savePaymentGatewaySettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    try {
        const settings: Omit<PaymentGatewaySettings, '_id'> = {
            merchantId: formData.get('merchantId') as string,
            saltKey: formData.get('saltKey') as string,
            saltIndex: formData.get('saltIndex') as string,
            environment: formData.get('environment') as 'staging' | 'production'
        };

        if (!settings.merchantId || !settings.saltKey || !settings.saltIndex) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('payment_gateway_settings').updateOne(
            { _id: 'phonepe' },
            { $set: settings },
            { upsert: true }
        );

        revalidatePath('/admin/dashboard/system');
        return { message: 'PhonePe settings saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleInitiateCreditPurchase(
    prevState: any,
    data: { credits: number, amount: number }
): Promise<{ redirectUrl?: string; error?: string }> {
     const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };
    
    const { db } = await connectToDatabase();
    
    const transactionId = new ObjectId();
    const transactionData: Omit<Transaction, '_id'> = {
        userId: new ObjectId(session.user._id),
        type: 'CREDITS',
        description: `${data.credits.toLocaleString()} Credits`,
        credits: data.credits,
        amount: data.amount * 100, // Store in paise
        status: 'PENDING',
        provider: 'phonepe',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    await db.collection('transactions').insertOne({ _id: transactionId, ...transactionData });
    
    return await createPhonePePaymentRequest(transactionId.toString(), transactionData.amount, session.user.name, session.user._id.toString());
}

export async function handleInitiatePayment(
  planId: string,
  projectId: string
): Promise<{ redirectUrl?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required.' };
  
  const { db } = await connectToDatabase();
  const plan = await db.collection<Plan>('plans').findOne({ _id: new ObjectId(planId) });
  if (!plan) return { error: 'Plan not found.' };

  const transactionId = new ObjectId();
  const transactionData: Omit<Transaction, '_id'> = {
    userId: new ObjectId(session.user._id),
    projectId: new ObjectId(projectId),
    type: 'PLAN',
    description: `Plan Upgrade: ${plan.name}`,
    planId: plan._id,
    amount: plan.price * 100, // Store in paise
    status: 'PENDING',
    provider: 'phonepe',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('transactions').insertOne({ _id: transactionId, ...transactionData });
  
  return await createPhonePePaymentRequest(transactionId.toString(), transactionData.amount, session.user.name, session.user._id.toString());
}

async function createPhonePePaymentRequest(
    merchantTransactionId: string, 
    amount: number, 
    userName: string, 
    userId: string
): Promise<{ redirectUrl?: string, error?: string }> {
    const pgSettings = await getPaymentGatewaySettings();
    if (!pgSettings) {
        return { error: 'Payment gateway is not configured by the administrator.' };
    }

    const { merchantId, saltKey, saltIndex, environment } = pgSettings;
    const isProd = environment === 'production';
    const host = isProd ? 'https://api.phonepe.com' : 'https://api-preprod.phonepe.com';
    const endpoint = '/pg/v1/pay';

    const payload = {
        merchantId,
        merchantTransactionId,
        merchantUserId: userId,
        amount: amount,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/${merchantTransactionId}`,
        redirectMode: "REDIRECT",
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
        mobileNumber: "9999999999", // Placeholder
        paymentInstrument: { type: "PAY_PAGE" }
    };
    
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = createHash('sha256').update(base64Payload + endpoint + saltKey).digest('hex') + `###${saltIndex}`;

    try {
        const response = await fetch(`${host}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
            },
            body: JSON.stringify({ request: base64Payload }),
        });
        
        const responseData = await response.json();

        if (responseData.success) {
            return { redirectUrl: responseData.data.instrumentResponse.redirectInfo.url };
        } else {
            console.error("PhonePe Error:", responseData);
            return { error: responseData.message || 'Failed to initiate payment.' };
        }
    } catch(e: any) {
        console.error("PhonePe Request Error:", e);
        return { error: 'Could not connect to payment gateway.' };
    }
}

export async function getTransactionStatus(transactionId: string): Promise<WithId<Transaction> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!ObjectId.isValid(transactionId)) return null;

    const { db } = await connectToDatabase();
    const transaction = await db.collection<Transaction>('transactions').findOne({
        _id: new ObjectId(transactionId),
        userId: new ObjectId(session.user._id)
    });
    
    return transaction ? JSON.parse(JSON.stringify(transaction)) : null;
}


export async function getTransactionsForUser(): Promise<WithId<Transaction>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    
    try {
        const { db } = await connectToDatabase();
        const transactions = await db.collection('transactions').find({
            userId: new ObjectId(session.user._id)
        }).sort({ createdAt: -1 }).limit(50).toArray();
        return JSON.parse(JSON.stringify(transactions));
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return [];
    }
}
