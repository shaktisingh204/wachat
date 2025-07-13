
import { googleAuthClient } from '@/lib/crm-auth';
import { saveOAuthTokens } from '@/app/actions/crm-email.actions';
import { getSession } from '@/app/actions';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
    const projectId = request.cookies.get('activeProjectId')?.value;
    if (!projectId) {
        return NextResponse.redirect(new URL('/dashboard?error=noproject', request.url));
    }

    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/crm/settings?error=auth_failed', request.url));
    }

    try {
        const { tokens } = await googleAuthClient.getToken(code);
        
        await saveOAuthTokens({
            projectId,
            provider: 'google',
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiryDate: tokens.expiry_date!,
        });

        return NextResponse.redirect(new URL('/dashboard/crm/settings?success=google_connected', request.url));

    } catch (error) {
        console.error('Google OAuth callback error:', error);
        return NextResponse.redirect(new URL('/dashboard/crm/settings?error=token_exchange_failed', request.url));
    }
}
