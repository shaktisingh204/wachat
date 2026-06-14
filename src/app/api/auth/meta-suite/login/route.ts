import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getCookieSecureFlag } from '@/lib/cookies';
import { META_OAUTH_DIALOG } from '@/lib/meta/graph-version';

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

  const searchParams = request.nextUrl.searchParams;
  const reauthorize = searchParams.get('reauthorize') === 'true';
  const stateFromClient = searchParams.get('state');

  // Use the state from the client if provided, otherwise default to 'facebook'.
  // This allows different flows to specify their own state.
  const state = stateFromClient || 'facebook';
  
  const redirectUri = `${appUrl}/auth/facebook/callback`;

  // Permissions for managing pages, posts, messages, and insights.
  const scopes = 'pages_show_list,pages_manage_posts,pages_read_engagement,pages_manage_metadata,read_insights,pages_messaging,leads_retrieval,business_management,instagram_basic,instagram_manage_comments,instagram_manage_messages,ads_management,ads_read';

  const facebookLoginUrl = new URL(META_OAUTH_DIALOG);
  facebookLoginUrl.searchParams.set('client_id', appId);
  facebookLoginUrl.searchParams.set('redirect_uri', redirectUri);
  facebookLoginUrl.searchParams.set('scope', scopes);
  facebookLoginUrl.searchParams.set('response_type', 'code');
  facebookLoginUrl.searchParams.set('state', state);

  if (reauthorize) {
    facebookLoginUrl.searchParams.set('auth_type', 'reauthorize');
  }

  const response = NextResponse.redirect(facebookLoginUrl.toString());

  // Set a secure, httpOnly cookie to store state and user ID
  response.cookies.set({
    name: 'onboarding_state',
    value: JSON.stringify({ state, userId: session.user._id }),
    httpOnly: true,
    secure: getCookieSecureFlag(),
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
