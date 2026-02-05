'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { SeoGscIntegration } from '@/lib/seo/definitions';
import { GscClient } from '@/lib/seo/gsc-client';
import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';

// 1. Initiate OAuth
export async function startGscAuth(projectId: string) {
    const url = GscClient.getAuthUrl(projectId);
    if (!url) throw new Error("Could not generate Auth URL. Check ENV vars.");
    redirect(url);
}

// 2. Handle Callback (Called by UI page /dashboard/seo/callback)
export async function exchangeGscCode(code: string, projectId: string) {
    try {
        const client = new GscClient();
        const tokens = await client.getToken(code);

        const { db } = await connectToDatabase();

        // Upsert Integration
        await db.collection('seo_gsc_integrations').updateOne(
            { projectId: new ObjectId(projectId) },
            {
                $set: {
                    credentials: tokens,
                    connectedAt: new Date(),
                }
            },
            { upsert: true }
        );

        // Auto-fetch sites to set default
        const connectedClient = new GscClient(tokens);
        const sites = await connectedClient.getSites();
        const siteList = sites.map(s => s.siteUrl || '');

        await db.collection('seo_gsc_integrations').updateOne(
            { projectId: new ObjectId(projectId) },
            { $set: { sites: siteList } }
        );

        return { success: true };
    } catch (e: any) {
        console.error("GSC Token Exchange Failed", e);
        return { error: e.message };
    }
}

// 3. Get Integration Status
export async function getGscIntegration(projectId: string) {
    const { db } = await connectToDatabase();
    const integration = await db.collection('seo_gsc_integrations').findOne({ projectId: new ObjectId(projectId) });
    return integration ? JSON.parse(JSON.stringify(integration)) : null;
}

// 4. Get Data
export async function getGscData(projectId: string, days: number = 28) {
    const { db } = await connectToDatabase();
    const integration = await db.collection<SeoGscIntegration>('seo_gsc_integrations').findOne({ projectId: new ObjectId(projectId) });

    if (!integration || !integration.credentials) return null;

    // Use selected site or first available
    const siteUrl = integration.selectedSite || integration.sites?.[0];
    if (!siteUrl) return { error: "No GSC property selected" };

    try {
        const client = new GscClient(integration.credentials as any);

        // Check expiry and refresh if needed? 
        // google-auth-library handles refresh automatically if refresh_token is present!

        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];

        const rows = await client.getAnalytics(siteUrl, startDate, endDate);
        return { success: true, rows, siteUrl };
    } catch (e: any) {
        console.error("GSC Data Fetch Failed", e);
        return { error: e.message };
    }
}
