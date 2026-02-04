
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SmsLog } from '@/lib/sms/types';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { db } = await connectToDatabase();

        // This is a generic webhook receiver. 
        // In a real expanded version, we would switch logic based on provider header or query param.
        // For now, we just log the incoming hook for debugging purposes.

        console.log('[SMS WEBHOOK] received:', body);

        // Example logic for Twilio or similar standard hooks if query params exist
        const messageId = body.MessageSid || body.messageId || body.id;
        const status = body.MessageStatus || body.status;

        if (messageId && status) {
            await db.collection<SmsLog>('sms_logs').updateOne(
                { providerMessageId: messageId },
                {
                    $set: {
                        status: status.toUpperCase(),
                        updatedAt: new Date()
                    }
                }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[SMS WEBHOOK] Error:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
