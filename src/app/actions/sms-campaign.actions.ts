'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { SmsCampaign } from "@/lib/sms/types";
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSmsCampaign(data: {
    name: string;
    templateId: string;
    mapping: Record<string, string>; // var name -> column name or static value
    audience: { type: 'tags' | 'csv' | 'contact_group', value: string[] | string };
    scheduledAt?: Date;
}) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) throw new Error("Unauthorized");
    const userId = new ObjectId(session.userId);

    const { db } = await connectToDatabase();

    // Fetch Template details
    const template = await db.collection('dlt_templates').findOne({
        _id: new ObjectId(data.templateId),
        userId
    });
    if (!template) throw new Error("Invalid Template");

    // Estimate count (placeholder logic, real logic needs to query contacts)
    let totalRecipients = 0;
    if (data.audience.type === 'csv') {
        // In a real app, we'd parse the CSV file related to this ID or similar
        // For now, assuming audience.value is a CSV string request or ID? 
        // Let's assume it's a list of numbers for simplicity if passed directly, or an ID of a file.
        // To be production level, we should likely be passing a File ID from a previous upload step.
    }

    const campaign: SmsCampaign = {
        _id: new ObjectId(),
        userId,
        name: data.name,
        templateId: new ObjectId(data.templateId),
        variableMapping: data.mapping,
        audienceConfig: data.audience,
        status: 'DRAFT', // Start as Draft, then worker or user confirms to 'SCHEDULED' or 'QUEUED'
        stats: { sent: 0, delivered: 0, failed: 0, clicked: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledAt: data.scheduledAt
    };

    const result = await db.collection('sms_campaigns').insertOne(campaign);

    // Redirect to campaign list or details
    // redirect('/dashboard/sms/campaigns'); // Do this in client
    return { success: true, campaignId: result.insertedId.toString() };
}

export async function launchCampaign(campaignId: string) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) throw new Error("Unauthorized");

    const { db } = await connectToDatabase();
    await db.collection('sms_campaigns').updateOne(
        { _id: new ObjectId(campaignId), userId: new ObjectId(session.userId) },
        { $set: { status: 'QUEUED', updatedAt: new Date() } }
    );

    revalidatePath('/dashboard/sms');
    return { success: true };
}
