'use server';

import { getSession } from "@/app/actions/index"; // Fixed import
import { connectToDatabase } from "@/lib/mongodb";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, type WithId } from "mongodb";
import { revalidatePath } from "next/cache";
import { crmAutoLeadsApi } from "@/lib/rust-client/crm-auto-leads";
import { RustApiError } from "@/lib/rust-client/fetcher";
import { recordRustFallback } from "@/lib/observability/rust-fallback-counter";

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

type AutoLeadRule = {
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

/**
 * Fetch a single auto lead rule document scoped to the current user.
 *
 * Dual-impl: when `USE_RUST_CRM=true` the Rust BFF is preferred and the
 * Mongo path serves as fallback for resilience.
 */
export async function getAutoLeadRuleById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAutoLeadsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getAutoLeadRuleById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'auto_lead_rule',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_auto_lead_rules').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error("Failed to fetch auto lead rule by id:", e);
        return null;
    }
}
