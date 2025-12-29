

'use server';

import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { Transaction, Plan } from '@/lib/definitions';
import Razorpay from 'razorpay';

export async function handleCreateRazorpayOrder(amount: number, currency: string): Promise<{ success: boolean; orderId?: string; error?: string; amount?: number; currency?: string, apiKey?: string; user?: any }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: "Authentication required." };
    }

    const razorpayConfig = session.user.plan?.razorpaySettings;
    if (!razorpayConfig?.keyId || !razorpayConfig.keySecret) {
        return { success: false, error: 'Razorpay is not configured for this account. Please contact support.' };
    }

    try {
        const instance = new Razorpay({
            key_id: razorpayConfig.keyId,
            key_secret: razorpayConfig.keySecret,
        });

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: currency,
            receipt: `receipt_order_${new ObjectId().toString()}`,
        };

        const order = await instance.orders.create(options);
        
        const { db } = await connectToDatabase();
        await db.collection('transactions').insertOne({
            userId: new ObjectId(session.user._id),
            type: 'CREDITS',
            amount: amount * 100,
            status: 'PENDING',
            provider: 'razorpay',
            providerOrderId: order.id,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as Omit<Transaction, '_id'>);


        return { 
            success: true, 
            orderId: order.id, 
            amount: order.amount,
            currency: order.currency,
            apiKey: razorpayConfig.keyId,
            user: { name: session.user.name, email: session.user.email }
        };
        
    } catch (e: any) {
        console.error('Razorpay order creation failed:', e);
        return { success: false, error: e.message || 'Failed to create Razorpay order.' };
    }
}

export async function getTransactions(): Promise<WithId<Transaction>[]> {
    const session = await getSession();
    if (!session?.user) {
        return [];
    }
    
    try {
        const { db } = await connectToDatabase();
        const transactions = await db.collection<Transaction>('transactions')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        return JSON.parse(JSON.stringify(transactions));
    } catch(e) {
        console.error("Failed to fetch transactions:", e);
        return [];
    }
}

export async function handlePlanChange(planId: string) {
    // Placeholder for plan change logic
    return { success: true };
}
