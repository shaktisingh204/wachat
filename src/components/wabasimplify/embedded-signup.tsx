'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';

interface EmbeddedSignupProps {
  appId: string;
  state: string;
  includeCatalog?: boolean;
}

export function EmbeddedSignup({ appId, state, includeCatalog }: EmbeddedSignupProps) {
  const [isClient, setIsClient] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!appUrl) {
    return <Button disabled size="lg">App URL not configured</Button>;
  }

  if (!isClient) {
    return (
      <Button disabled size="lg">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading...
      </Button>
    );
  }

  const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

  // Only official WhatsApp scopes
  let scopes = 'whatsapp_business_management,whatsapp_business_messaging';
  if (includeCatalog) {
    scopes += ',catalog_management';
  }

  const esUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}&display=popup`;

  return (
    <Button
      asChild
      size="lg"
      className="bg-[#25D366] hover:bg-[#25D366]/90 text-white w-full flex items-center justify-center"
    >
      <a href={esUrl} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className="mr-2 h-5 w-5" />
        Connect with WhatsApp
      </a>
    </Button>
  );
}
