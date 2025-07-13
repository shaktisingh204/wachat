
import { outlookAuthClient } from '@/lib/crm-auth';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const authCodeUrlParameters = {
            scopes: ["User.Read", "Mail.Read", "Mail.Send"],
            redirectUri: process.env.OUTLOOK_REDIRECT_URI!,
        };

        const authUrl = await outlookAuthClient.getAuthCodeUrl(authCodeUrlParameters);
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Outlook connect error:", error);
        return new Response("Error generating Outlook auth URL", { status: 500 });
    }
}
