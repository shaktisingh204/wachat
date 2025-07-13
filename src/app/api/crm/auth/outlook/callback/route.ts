

import { outlookAuthClient } from '@/lib/crm-auth';
import { saveOAuthTokens } from '@/app/actions/crm-email.actions';
import { getSession } from '@/app/actions';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/crm/settings?error=auth_failed', request.url));
    }
    
    const tokenRequest = {
        code: code,
        scopes: ["User.Read", "Mail.Read", "Mail.Send", "offline_access"],
        redirectUri: process.env.OUTLOOK_REDIRECT_URI!,
    };

    try {
        const response = await outlookAuthClient.acquireTokenByCode(tokenRequest);
        
        if (!response.accessToken || !response.refreshToken || !response.expiresOn) {
            throw new Error("Failed to acquire complete token set from Outlook.");
        }
        
        await saveOAuthTokens({
            userId: session.user._id.toString(),
            provider: 'outlook',
            accessToken: response.accessToken,
            refreshToken: response.refreshToken!,
            expiryDate: response.expiresOn!.getTime(),
        });
        
        return NextResponse.redirect(new URL('/dashboard/crm/settings?success=outlook_connected', request.url));

    } catch (error) {
        console.error('Outlook OAuth callback error:', error);
        return NextResponse.redirect(new URL('/dashboard/crm/settings?error=token_exchange_failed', request.url));
    }
}
