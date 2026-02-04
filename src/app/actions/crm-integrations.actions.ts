'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export type IntegrationStatus = {
    shopify: boolean;
    zapier: boolean;
    mailchimp: boolean;
    slack: boolean;
    gmail: boolean;
    whatsapp: boolean;
};

export async function getIntegrationTypes(): Promise<IntegrationStatus> {
    const session = await getSession();
    if (!session?.user) return { shopify: false, zapier: false, mailchimp: false, slack: false, gmail: false, whatsapp: false };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        // Check for Connected Accounts
        const emailAccount = await db.collection('google_tokens').findOne({ userId: userObjectId });
        const whatsappAccount = await db.collection('whatsapp_configs').findOne({ userId: userObjectId });

        // Mock checks for others for now until their specific collections are clear
        // In a real app we'd check oauth_tokens or similar

        return {
            shopify: false, // Implement when Shopify module is requested
            zapier: false,
            mailchimp: false,
            slack: false,
            gmail: !!emailAccount,
            whatsapp: !!whatsappAccount
        };
    } catch (e) {
        console.error("Failed to fetch integration status:", e);
        return { shopify: false, zapier: false, mailchimp: false, slack: false, gmail: false, whatsapp: false };
    }
}
