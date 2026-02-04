import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messageId, status, error } = body;
        // Different providers use different formats. 
        // This is a GENERIC webhook handler. 
        // Real implementation requires provider-specific parsers.
        // For now, we assume our Generic Provider callback format.

        if (!messageId) {
            return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Find the log entry
        const log = await db.collection('sms_logs').findOne({ providerMessageId: messageId });
        if (!log) {
            return NextResponse.json({ error: "Log not found" }, { status: 404 });
        }

        const newStatus = status === 'DELIVERED' ? 'DELIVERED'
            : status === 'FAILED' ? 'FAILED'
                : status === 'SENT' ? 'SENT'
                    : log.status;

        // Update Log
        await db.collection('sms_logs').updateOne(
            { _id: log._id },
            {
                $set: {
                    status: newStatus,
                    updatedAt: new Date(),
                    ...(error ? { errorReason: error } : {})
                }
            }
        );

        // Update Campaign Stats (Incrementally)
        if (log.campaignId && newStatus !== log.status) {
            const campaignId = log.campaignId;
            const incField = newStatus === 'DELIVERED' ? 'stats.delivered'
                : newStatus === 'FAILED' ? 'stats.failed'
                    : null;

            if (incField) {
                await db.collection('sms_campaigns').updateOne(
                    { _id: campaignId },
                    { $inc: { [incField]: 1 } }
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Webhook Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // Some providers use GET for webhooks
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('id');
    const status = searchParams.get('status');

    if (messageId && status) {
        // reuse logic... for now just return success
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ status: "Listening" });
}
