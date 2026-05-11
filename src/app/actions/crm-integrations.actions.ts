'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLeadGenConfig } from '@/lib/rust-client/wachat-facebook-leadgen-config';

export type IntegrationStatus = {
    shopify: boolean;
    zapier: boolean;
    mailchimp: boolean;
    slack: boolean;
    gmail: boolean;
    whatsapp: boolean;
    facebook: boolean;
};

const EMPTY_STATUS: IntegrationStatus = {
    shopify: false,
    zapier: false,
    mailchimp: false,
    slack: false,
    gmail: false,
    whatsapp: false,
    facebook: false,
};

export async function getIntegrationTypes(): Promise<IntegrationStatus> {
    const session = await getSession();
    if (!session?.user) return EMPTY_STATUS;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [emailAccount, whatsappAccount, leadGen] = await Promise.all([
            db.collection('google_tokens').findOne({ userId: userObjectId }),
            db.collection('whatsapp_configs').findOne({ userId: userObjectId }),
            getLeadGenConfig().catch(() => ({ config: null })),
        ]);

        return {
            shopify: false,
            zapier: false,
            mailchimp: false,
            slack: false,
            gmail: !!emailAccount,
            whatsapp: !!whatsappAccount,
            facebook: !!(leadGen?.config?.pageId && leadGen.config.isActive),
        };
    } catch (e) {
        console.error("Failed to fetch integration status:", e);
        return EMPTY_STATUS;
    }
}
