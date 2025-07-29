

import { googleAuthClient } from '@/lib/crm-auth';
import { saveOAuthTokens } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions';
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/email/settings?error=auth_failed', request.url));
    }

    try {
        const { tokens } = await googleAuthClient.getToken(code);
        googleAuthClient.setCredentials(tokens);

        const oauth2 = google.oauth2({
            auth: googleAuthClient,
            version: 'v2',
        });
        const userInfo = await oauth2.userinfo.get();
        
        await saveOAuthTokens({
            userId: session.user._id.toString(),
            provider: 'google',
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiryDate: tokens.expiry_date!,
            fromEmail: userInfo.data.email!,
            fromName: userInfo.data.name!,
        });

        return NextResponse.redirect(new URL('/dashboard/email/settings?success=google_connected', request.url));

    } catch (error) {
        console.error('Google OAuth callback error:', error);
        return NextResponse.redirect(new URL('/dashboard/email/settings?error=token_exchange_failed', request.url));
    }
}
