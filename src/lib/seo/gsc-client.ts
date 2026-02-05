import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { SeoGscIntegration } from './definitions';

// Ensure these are in .env
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/seo/callback` : 'http://localhost:3002/dashboard/seo/callback';

export class GscClient {
    private auth: OAuth2Client;

    constructor(tokens?: any) {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            throw new Error("Google Credentials Missing in ENV");
        }

        this.auth = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        if (tokens) {
            this.auth.setCredentials(tokens);
        }
    }

    static getAuthUrl(projectId: string) {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.error("Missing Google Credentials");
            return null;
        }

        const client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI
        );

        return client.generateAuthUrl({
            access_type: 'offline', // Critical for refresh token
            scope: [
                'https://www.googleapis.com/auth/webmasters.readonly',
                'https://www.googleapis.com/auth/webmasters' // Needed for sitemaps if we want to submit
            ],
            state: projectId // Pass project ID to callback
        });
    }

    async getToken(code: string) {
        const { tokens } = await this.auth.getToken(code);
        return tokens;
    }

    async getSites() {
        const searchConsole = google.searchconsole({ version: 'v1', auth: this.auth });
        const res = await searchConsole.sites.list();
        return res.data.siteEntry || [];
    }

    async getAnalytics(siteUrl: string, startDate: string, endDate: string) {
        const searchConsole = google.searchconsole({ version: 'v1', auth: this.auth });
        const res = await searchConsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['date'],
                rowLimit: 50
            }
        });
        return res.data.rows || [];
    }
}
