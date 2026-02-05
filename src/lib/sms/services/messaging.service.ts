
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { SmsService } from './provider.factory';
import { SmsTemplateService } from './template.service';
import { DltSmsTemplate, SmsLog, SmsProviderConfig } from '../types';

export interface SendTemplateSmsParams {
    userId: string | ObjectId;
    recipient: string;
    dltTemplateId: string;
    headerId?: string; // Optional
    variableValues: string[]; // Ordered values
}

export async function sendTemplateSms(params: SendTemplateSmsParams) {
    const { userId, recipient, dltTemplateId, variableValues } = params;

    const provider = await SmsService.getProvider(userId);
    if (!provider) {
        throw new Error('No active SMS provider configuration found.');
    }

    const { db } = await connectToDatabase();

    // Fetch Config for PE ID
    const smsConfig = await db.collection<SmsProviderConfig>('sms_configs').findOne({ userId: new ObjectId(userId), isActive: true });

    // 1. Fetch Template
    const template = await db.collection<DltSmsTemplate>('dlt_templates').findOne({
        userId: new ObjectId(userId),
        dltTemplateId: dltTemplateId
    });

    if (!template) {
        throw new Error(`DLT Template with ID ${dltTemplateId} not found.`);
    }

    // 2. Interpolate Content
    const messageContent = SmsTemplateService.interpolate(template, variableValues);

    // 3. Send Message
    const result = await provider.send(
        recipient,
        messageContent,
        {
            dltTemplateId: template.dltTemplateId,
            dltPrincipalEntityId: smsConfig?.dltPeId || '',
            dltHeaderId: template.headerId
        }
    );

    // 4. Log
    const log: SmsLog = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        to: recipient,
        content: messageContent,
        provider: 'generic', // Should be dynamic
        providerMessageId: result.messageId || 'unknown',
        status: result.status === 'SENT' || result.status === 'QUEUED' ? 'SENT' : 'FAILED',
        createdAt: new Date(),
        updatedAt: new Date(),
        errorReason: result.error
    };

    await db.collection('sms_logs').insertOne(log);

    if (result.status === 'FAILED') {
        throw new Error(result.error || 'Failed to send SMS.');
    }

    return { success: true, messageId: result.messageId, message: 'SMS sent successfully.' };
}
