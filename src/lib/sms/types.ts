
import { ObjectId } from 'mongodb';

export type SmsProviderType =
    | 'twilio'
    | 'msg91'
    | 'aws-sns'
    | 'gupshup'
    | 'plivo'
    | 'vonage'
    | 'clicksend'
    | 'messagebird'
    | 'sinch'
    | 'kaleyra'
    | '2factor'
    | 'fast2sms'
    | 'infobip'
    | 'termii'
    | 'telnyx'
    | 'bandwidth'
    | 'cm-com'
    | 'textmagic'
    | 'karix'
    | 'textlocal'
    | 'africastalking'
    | 'bulksms'
    | 'generic'; // Fallback for custom HTTP APIs

export interface SmsProviderConfig {
    _id: ObjectId;
    userId: ObjectId;
    provider: SmsProviderType | string; // loose typing for now to match definitions
    isActive: boolean;
    credentials: Record<string, string | undefined>; // Flexible to support 20+ providers
    dltPeId?: string; // Principal Entity ID (India)
    defaultSenderId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DltSmsTemplate {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    headerId: string; // 6 char sender ID e.g. WACHAT
    dltTemplateId: string; // The 110xxxx ID
    content: string; // "Hello {#var#}, your OTP is {#var#}."
    variableCount: number;
    type: 'Transactional' | 'Promotional' | 'Service';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: Date;
    updatedAt: Date;
}

export interface SmsCampaign {
    _id: ObjectId;
    userId: ObjectId;
    name: string;
    templateId: ObjectId;
    variableMapping?: Record<string, string>; // Position index -> value
    audienceConfig?: {
        type: 'manual' | 'csv' | 'contact_group' | 'tags';
        value: string | string[]; // CSV string, Group ID, or List of tags
    };
    status: 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'SENDING' | 'COMPLETED' | 'FAILED'; // Added SENDING
    stats: {
        sent: number;
        delivered: number;
        failed: number;
        clicked: number;
    };
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    scheduledAt?: Date;
    error?: string;
}

export interface SmsLog {
    _id: ObjectId;
    userId: ObjectId;
    campaignId?: ObjectId;
    to: string; // Phone number
    content: string; // Actual text sent
    provider: SmsProviderType;
    providerMessageId: string; // SID or request ID
    status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'UNDELIVERED';
    cost?: number; // If we track cost
    errorCode?: string;
    errorReason?: string;
    sentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
