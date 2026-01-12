
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?._id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appUrl) {
    throw new Error('Facebook integration is not configured on the server.');
  }

  const state = 'facebook'; // Use a simple state for the Meta Suite flow
  const redirectUri = `${appUrl}/auth/facebook/callback`;

  // Permissions required for managing pages, ads, and reading insights
  const scopes = 'pages_show_list,pages_manage_ads,pages_read_engagement,ads_management,business_management,pages_manage_posts,read_insights,pages_manage_engagement,pages_messaging';

  const facebookLoginUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  facebookLoginUrl.searchParams.set('client_id', appId);
  facebookLoginUrl.searchParams.set('redirect_uri', redirectUri);
  facebookLoginUrl.searchParams.set('scope', scopes);
  facebookLoginUrl.searchParams.set('response_type', 'code');
  facebookLoginUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(facebookLoginUrl.toString());

  // Set a secure, httpOnly cookie to store the state and user ID
  response.cookies.set({
    name: 'onboarding_state',
    value: JSON.stringify({ state, userId: session.user._id }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
