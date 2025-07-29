

import { outlookAuthClient } from '@/lib/crm-auth';
import { saveOAuthTokens } from '@/app/actions/email.actions';
import { getSession } from '@/app/actions';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

async function getUserInfo(accessToken: string) {
  const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/email/settings?error=auth_failed', request.url));
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
        
        const userInfo = await getUserInfo(response.accessToken);

        await saveOAuthTokens({
            userId: session.user._id.toString(),
            provider: 'outlook',
            accessToken: response.accessToken,
            refreshToken: response.refreshToken!,
            expiryDate: response.expiresOn!.getTime(),
            fromEmail: userInfo.mail || userInfo.userPrincipalName,
            fromName: userInfo.displayName,
        });
        
        return NextResponse.redirect(new URL('/dashboard/email/settings?success=outlook_connected', request.url));

    } catch (error) {
        console.error('Outlook OAuth callback error:', error);
        return NextResponse.redirect(new URL('/dashboard/email/settings?error=token_exchange_failed', request.url));
    }
}
