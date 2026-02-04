'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { SmsProviderConfig, SmsProviderType } from "@/lib/sms/types";
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
// Remove DltSmsTemplate import if unused, or keep
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveSmsConfig(formData: FormData) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');

    if (!session?.userId) throw new Error("Unauthorized");
    const userId = new ObjectId(session.userId);

    const provider = formData.get('provider') as SmsProviderType;
    if (!['twilio', 'msg91'].includes(provider)) throw new Error("Invalid provider");

    // Generic extraction logic
    // We iterate over the known keys or just dump entries?
    // FormData can be iterated.
    const credentials: Record<string, string> = {};

    // Explicit known keys for Typescript sanity, but we can capture all relevant ones.
    const potentialKeys = ['accountSid', 'authToken', 'fromNumber', 'authKey', 'senderId', 'userId', 'password', 'authId', 'src', 'apiKey', 'baseUrl'];

    potentialKeys.forEach(key => {
        const val = formData.get(key);
        if (val) credentials[key] = val as string;
    });

    // DLT
    const principalEntityId = formData.get('principalEntityId') as string;

    const { db } = await connectToDatabase();

    const config: Partial<SmsProviderConfig> = {
        userId,
        provider,
        isActive: true,
        credentials: credentials,
        dlt: {
            principalEntityId,
            entityName: '' // Optional
        },
        updatedAt: new Date()
    };

    await db.collection('sms_configs').updateOne(
        { userId },
        {
            $set: config as SmsProviderConfig,
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    );

    revalidatePath('/dashboard/sms/config');
    return { success: true, message: 'Configuration saved successfully' };
}

export async function getSmsConfig() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (!sessionToken) return null;

    const session = await getDecodedSession(sessionToken);
    if (!session?.userId) return null;

    const { db } = await connectToDatabase();

    // We explicitly cast to avoid the MongoDB vs internal ObjectId type mismatch if it occurs
    const config = await db.collection('sms_configs').findOne({ userId: new ObjectId(session.userId) });

    // Convert ObjectId to string for client component consumption if needed, 
    // or return as is if passing to a server component
    if (config) {
        return {
            ...config,
            _id: config._id.toString(),
            userId: config.userId.toString(),
        } as any as SmsProviderConfig; // Cast to known type
    }
    return null;
}
