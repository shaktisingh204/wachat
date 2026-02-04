'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { SmsCampaign } from "@/lib/sms/types";
import { revalidatePath } from "next/cache";

export async function getSmsCampaigns() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return [];

    const { db } = await connectToDatabase();

    const campaigns = await db.collection<SmsCampaign>('sms_campaigns')
        .find({ userId: new ObjectId(session.userId) })
        .sort({ createdAt: -1 })
        .toArray();

    return campaigns.map(c => ({
        ...c,
        _id: c._id.toString(),
        userId: c.userId.toString(),
        templateId: c.templateId.toString(),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        scheduledAt: c.scheduledAt?.toISOString(),
        completedAt: c.completedAt?.toISOString(),
    }));
}

export async function deleteSmsCampaign(id: string) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return { success: false, error: 'Unauthorized' };

    const { db } = await connectToDatabase();
    await db.collection('sms_campaigns').deleteOne({
        _id: new ObjectId(id),
        userId: new ObjectId(session.userId)
    });

    revalidatePath('/dashboard/sms/campaigns');
    return { success: true };
}
