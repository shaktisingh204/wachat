
import { googleAuthClient } from '@/lib/crm-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const authUrl = googleAuthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to get a refresh token
    scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });

  return NextResponse.redirect(authUrl);
}
