import { Queue } from 'bullmq';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import * as crypto from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import {
  EnqueueSendInput,
  EnqueueSendResult,
  SabsmsSuppression,
  SabsmsMessage,
  SabsmsMessageStatus
} from '../types';

const redisConn = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

const sendQueue = new Queue('sabsms:send', { connection: redisConn });

function normalizePhoneNumber(phone: string): string {
  try {
    const parsed = parsePhoneNumberWithError(phone);
    return parsed.format('E.164');
  } catch (error) {
    // Fallback
    if (phone.startsWith('+')) return phone;
    return `+${phone.replace(/\D/g, '')}`;
  }
}

async function isSuppressed(workspaceId: string, phone: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');
  const count = await db.collection<SabsmsSuppression>('sabsms_suppressions').countDocuments({
    workspaceId,
    phoneHash,
  });
  return count > 0;
}

function estimateSegments(body: string): number {
  const isUnicode = /[^\u0000-\u007F]/.test(body);
  const charsPerSegment = isUnicode ? 70 : 160;
  return Math.max(1, Math.ceil(body.length / charsPerSegment));
}

async function reserveCredits(workspaceId: string, segments: number): Promise<boolean> {
  // Simple stub for credit reservation for Phase 1.
  // In later phases, integrate with src/lib/billing or actual engine reservation.
  return true;
}

export async function enqueueMessage(input: EnqueueSendInput): Promise<EnqueueSendResult> {
  const normalizedTo = normalizePhoneNumber(input.to);

  // Check suppression
  const suppressed = await isSuppressed(input.workspaceId, normalizedTo);
  if (suppressed) {
    return {
      id: new ObjectId().toString(),
      status: 'failed',
      estimatedCost: 0,
      segments: 0
    };
  }

  // Estimate cost
  const segments = estimateSegments(input.body);
  const estimatedCost = segments * 1; // 1 cent per segment placeholder

  // Reserve credits
  const creditsReserved = await reserveCredits(input.workspaceId, segments);
  if (!creditsReserved) {
    return {
      id: new ObjectId().toString(),
      status: 'failed',
      estimatedCost,
      segments
    };
  }

  // Generate Message ID
  const messageId = new ObjectId();

  // Create message document
  const messageDocument: SabsmsMessage = {
    _id: messageId,
    workspaceId: input.workspaceId,
    idempotencyKey: input.idempotencyKey,
    direction: 'outbound',
    channel: input.channel || 'sms',
    from: input.from || '',
    to: normalizedTo,
    body: input.body,
    media: input.media,
    category: input.category,
    status: 'queued',
    provider: input.provider || 'twilio',
    providerAccountId: input.providerAccountId,
    templateId: input.templateId,
    campaignId: input.campaignId,
    contactId: input.contactId,
    eventKey: input.eventKey,
    segmentsCount: segments,
    price: estimatedCost,
    tags: input.tags,
    queuedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { db } = await connectToDatabase();
  await db.collection<SabsmsMessage>('sabsms_messages').insertOne(messageDocument);

  // Push to BullMQ
  await sendQueue.add(
    'send',
    { messageId: messageId.toString(), workspaceId: input.workspaceId },
    {
      jobId: input.idempotencyKey || messageId.toString(),
      removeOnComplete: true,
      removeOnFail: false
    }
  );

  return {
    id: messageId.toString(),
    status: 'queued',
    segments,
    estimatedCost,
  };
}
