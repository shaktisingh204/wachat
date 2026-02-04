
import { ObjectId } from 'mongodb';

export type SmsProviderType =
    | 'twilio'
    | 'msg91'
    | 'gupshup'
    | 'plivo'
    | 'vonage'
    | 'clickatell'
    | 'textlocal'
    | 'karix'
    | 'valuefirst'
    | 'kaleyra'
    | 'fast2sms'
    | 'twofactor' // 2Factor
    | 'sinch'
    | 'infobip'
    | 'aws_sns'
    | 'messagebird'
    | 'telesign'
    | 'bandwidth'
    | 'cm_com'
    | 'routemobile'
    | 'generic'; // Fallback for custom HTTP APIs

export interface SmsProviderConfig {
    _id: ObjectId;
    userId: ObjectId;
    provider: SmsProviderType;
    isActive: boolean;
    credentials: Record<string, string | undefined>; // Flexible to support 20+ providers
    dlt?: {
        principalEntityId: string;
        entityName?: string;
    };
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
