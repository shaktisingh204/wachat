'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';

export async function getAdvancedGscData(projectId: string, startDate: string, endDate: string, dimensions: string[], filters?: any[]) {
    const { db } = await connectToDatabase();
    const integration = await db.collection('seo_gsc_integrations').findOne({ projectId: new ObjectId(projectId) });

    if (!integration || !integration.credentials) return { error: "Not connected" };

    const siteUrl = integration.selectedSite || integration.sites?.[0];
    if (!siteUrl) return { error: "No site selected" };

    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials(integration.credentials);

        const searchConsole = google.searchconsole({ version: 'v1', auth } as any);

        const requestBody: any = {
            startDate,
            endDate,
            dimensions, // 'date', 'query', 'page', 'country', 'device'
            rowLimit: 1000
        };

        if (filters && filters.length > 0) {
            requestBody.dimensionFilterGroups = [{
                filters: filters.map(f => ({
                    dimension: f.dimension,
                    operator: f.operator || 'contains',
                    expression: f.expression
                }))
            }];
        }

        const res = await searchConsole.searchanalytics.query({
            siteUrl,
            requestBody
        });

        return { success: true, rows: res.data.rows || [], siteUrl };
    } catch (e: any) {
        console.error("GSC Data Fetch Failed", e);
        return { error: e.message };
    }
}
