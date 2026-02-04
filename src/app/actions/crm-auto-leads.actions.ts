'use server';

import { getSession } from "@/app/actions/index"; // Fixed import
import { connectToDatabase } from "@/lib/mongodb";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, type WithId } from "mongodb";
import { revalidatePath } from "next/cache";

export type AutoLeadRule = {
    _id: string;
    name: string;
    source: 'Email' | 'SMS' | 'WhatsApp';
    keyword: string;
    leadSource: string; // e.g., "Website Enquiry"
    createdAt?: Date;
};

export async function getAutoLeadRules(): Promise<WithId<AutoLeadRule>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const rules = await db.collection('crm_auto_lead_rules').find({
            userId: new ObjectId(session.user._id)
        }).sort({ createdAt: -1 }).toArray();

        // Safe clone
        return JSON.parse(JSON.stringify(rules));
    } catch (e) {
        console.error("Failed to fetch auto lead rules:", e);
        return [];
    }
}

export async function saveAutoLeadRule(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    const name = formData.get('name') as string;
    const source = formData.get('source') as string;
    const keyword = formData.get('keyword') as string;
    const leadSource = formData.get('leadSource') as string;

    if (!name || !keyword) {
        return { success: false, error: "Name and Keyword are required" };
    }

    try {
        const { db } = await connectToDatabase();

        await db.collection('crm_auto_lead_rules').insertOne({
            userId: new ObjectId(session.user._id),
            name,
            source,
            keyword,
            leadSource,
            createdAt: new Date()
        });

        revalidatePath('/dashboard/crm/auto-leads-setup');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteAutoLeadRule(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return { success: false, error: "Invalid request" };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_auto_lead_rules').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id)
        });

        revalidatePath('/dashboard/crm/auto-leads-setup');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
