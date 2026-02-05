"use server";
import { connectToDatabase } from "@/lib/mongodb";
import { SmsProviderConfig } from "@/lib/definitions"; // Switch to definitions
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveSmsConfig(formData: FormData) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');

    if (!session?.userId) throw new Error("Unauthorized");
    const userId = new ObjectId(session.userId);

    const provider = formData.get('provider') as string;
    const isActive = formData.get('isActive') === 'on';

    // Extract credentials dynamically
    const credentials: Record<string, string> = {};
    const reservedKeys = ['provider', 'isActive', 'principalEntityId', '$ACTION_ID']; // Next.js internal key

    for (const [key, value] of formData.entries()) {
        if (!reservedKeys.includes(key) && typeof value === 'string' && value.trim() !== '') {
            credentials[key] = value;
        }
    }

    // DLT
    const principalEntityId = formData.get('principalEntityId') as string;

    const { db } = await connectToDatabase();

    const config: Partial<SmsProviderConfig> = {
        userId,
        provider,
        isActive,
        credentials: credentials,
        dltPeId: principalEntityId, // Changed to match schema field name
        updatedAt: new Date()
    };

    // We can also store provider specific senderId if we want to normalize it
    if (credentials.senderId) {
        config.defaultSenderId = credentials.senderId;
    }

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
