
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?._id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  const searchParams = request.nextUrl.searchParams;
  const includeCatalog = searchParams.get('includeCatalog') === 'true';

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !configId || !appUrl) {
    throw new Error('Facebook integration is not configured on the server.');
  }

  const state = nanoid();
  const redirectUri = `${appUrl}/auth/facebook/callback`;

  // Base scopes
  let scopes = 'whatsapp_business_management,whatsapp_business_messaging';
  // Add catalog scopes if requested
  if (includeCatalog) {
    scopes += ',catalog_management,business_management';
  }

  const facebookLoginUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
  facebookLoginUrl.searchParams.set('client_id', appId);
  facebookLoginUrl.searchParams.set('redirect_uri', redirectUri);
  facebookLoginUrl.searchParams.set('scope', scopes);
  facebookLoginUrl.searchParams.set('response_type', 'code');
  facebookLoginUrl.searchParams.set('state', state);

  // For Embedded Signup, we pass the config_id
  facebookLoginUrl.searchParams.set('config_id', configId);
  facebookLoginUrl.searchParams.set('override_default_response_type', 'true');

  const response = NextResponse.redirect(facebookLoginUrl.toString());

  // Set a secure, httpOnly cookie to store the state and user ID
  response.cookies.set({
    name: 'onboarding_state',
    value: JSON.stringify({ state, userId: session.user._id, includeCatalog }),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
