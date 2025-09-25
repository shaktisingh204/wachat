
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import type { EmailCampaign } from '@/lib/definitions';
import { getTransporter } from '@/lib/email-service';
import { getErrorMessage } from '@/lib/utils';
import { getSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

async function sendCampaign(campaign: WithId<EmailCampaign>) {
    const { db } = await connectToDatabase();
    
    // This is a simplified user fetch. In a real multi-tenant app,
    // you would have a more robust way to get the sender's auth context.
    const user = await db.collection('users').findOne({_id: campaign.userId});
    if(!user) {
        console.error(`User not found for campaign ${campaign._id}`);
        return;
    }
    const session = { user };

    const transporter = await getTransporter(session as any);

    for (const contact of campaign.contacts) {
        const contactEmail = (contact as any).email;
        if (!contactEmail) continue;

        const interpolatedSubject = campaign.subject.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (contact as any)[key] || match);
        const interpolatedBody = campaign.body.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (contact as any)[key] || match);

        try {
            await transporter.sendMail({
                from: `"${campaign.fromName}" <${campaign.fromEmail}>`,
                to: contactEmail,
                subject: interpolatedSubject,
                html: interpolatedBody,
            });
        } catch (e) {
            console.error(`Failed to send scheduled email to ${contactEmail}:`, getErrorMessage(e));
        }
    }
    
    await db.collection('email_campaigns').updateOne({ _id: campaign._id }, { $set: { status: 'sent', sentAt: new Date() } });
}

export async function GET(request: Request) {
    try {
        const { db } = await connectToDatabase();

        const campaignsToSend = await db.collection<WithId<EmailCampaign>>('email_campaigns').find({
            status: 'scheduled',
            scheduledAt: { $lte: new Date() }
        }).toArray();

        if (campaignsToSend.length === 0) {
            return NextResponse.json({ message: "No scheduled email campaigns to send." });
        }

        await Promise.all(campaignsToSend.map(sendCampaign));

        return NextResponse.json({
            message: `Successfully processed and sent ${campaignsToSend.length} scheduled campaign(s).`,
        });

    } catch (error: any) {
        console.error('Error in send-scheduled-emails cron job:', error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}

// Allow POST requests for manual triggering
export async function POST(request: Request) {
    return GET(request);
}
