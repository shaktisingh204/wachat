
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?._id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Use the Facebook App ID, as Ad Manager is a Facebook product.
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appUrl) {
    throw new Error('Facebook/Ad Manager integration is not configured on the server.');
  }

  const state = 'ad_manager'; // Unique state for this flow
  const redirectUri = `${appUrl}/auth/facebook/callback`;

  // Scopes required for managing ads
  const scopes = 'ads_read,ads_management,business_management';

  const facebookLoginUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  facebookLoginUrl.searchParams.set('client_id', appId);
  facebookLoginUrl.searchParams.set('redirect_uri', redirectUri);
  facebookLoginUrl.searchParams.set('scope', scopes);
  facebookLoginUrl.searchParams.set('response_type', 'code');
  facebookLoginUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(facebookLoginUrl.toString());

  // Set a cookie to verify the state on callback
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
