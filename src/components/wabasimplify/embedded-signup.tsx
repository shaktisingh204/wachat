'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  onSuccess?: () => void;
}

export default function EmbeddedSignup({
  appId,
  configId,
  includeCatalog,
}: EmbeddedSignupProps) {
  const [isClient, setIsClient] = useState(false);
  const [stateToken, setStateToken] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);

    // 🔐 Generate secure CSRF state
    const state = crypto.randomUUID();
    sessionStorage.setItem('meta_oauth_state', state);
    setStateToken(state);
  }, []);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error('NEXT_PUBLIC_APP_URL is not set.');
    return (
      <Button disabled size="lg">
        App URL not configured
      </Button>
    );
  }

  if (!isClient || !stateToken) {
    return (
      <Button disabled size="lg">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </Button>
    );
  }

  const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

  // ✅ REQUIRED SCOPES
  let scopes =
    'business_management,whatsapp_business_management,whatsapp_business_messaging';

  if (includeCatalog) {
    scopes += ',catalog_management';
  }

  // ✅ FULL OAuth URL (Meta v23)
  const facebookLoginUrl =
    `https://www.facebook.com/v23.0/dialog/oauth` +
    `?client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&config_id=${configId}` +
    `&state=${stateToken}` +
    `&auth_type=rerequest`; // 🚨 REQUIRED

  return (
    <Button
      asChild
      size="lg"
      className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full"
    >
      <a href={facebookLoginUrl}>
        <WhatsAppIcon className="mr-2 h-5 w-5" />
        Connect with Facebook
      </a>
    </Button>
  );
}
