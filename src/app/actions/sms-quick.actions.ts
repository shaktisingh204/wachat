'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { SmsService } from "@/lib/sms/services/provider.factory";
import { ObjectId } from "mongodb";

export async function sendQuickSms(to: string, message: string, templateId?: string) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) throw new Error("Unauthorized");

    const { db } = await connectToDatabase();

    // 1. Get Config
    const config = await db.collection('sms_configs').findOne({ userId: new ObjectId(session.userId) });
    if (!config || !config.isActive) throw new Error("No active SMS provider configuration.");

    // 2. Get Provider
    const provider = await SmsService.getProvider(session.userId);
    if (!provider) throw new Error("Provider initialization failed.");

    // 3. DLT Params
    // If templateId is provided, fetch it. If not, this might fail on Indian networks if DLT is required.
    // For Quick Send, we should ideally select a template.
    let dltParams = {
        dltTemplateId: '',
        dltPrincipalEntityId: config.dlt?.principalEntityId || '',
        dltHeaderId: ''
    };

    if (templateId) {
        const template = await db.collection('dlt_templates').findOne({ _id: new ObjectId(templateId) });
        if (template) {
            dltParams.dltTemplateId = template.dltTemplateId;
            dltParams.dltHeaderId = template.headerId;
            // Ideally we also validate content matches template here, but for Quick Send allow override?
            // DLT allows variable replacement. Ideally the UI passes the *final* message.
        }
    }

    // 4. Send
    const result = await provider.send(to, message, dltParams);

    // 5. Log
    await db.collection('sms_logs').insertOne({
        userId: new ObjectId(session.userId),
        to,
        content: message,
        provider: config.provider,
        status: result.status,
        providerMessageId: result.messageId,
        error: result.error,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return {
        success: result.status === 'SENT' || result.status === 'QUEUED',
        messageId: result.messageId,
        error: result.error
    };
}
