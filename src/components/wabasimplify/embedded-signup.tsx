
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { saveOnboardingState } from '@/app/actions/onboarding.actions';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  state: 'whatsapp' | 'facebook';
}

export default function EmbeddedSignup({
  appId,
  configId,
  includeCatalog,
  state,
}: EmbeddedSignupProps) {
  const [isClient, setIsClient] = useState(false);
  const [facebookLoginUrl, setFacebookLoginUrl] = useState<string | null>(null);
  const { sessionUser } = useProject();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !sessionUser) return;

    const setupLoginUrl = async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        console.error('NEXT_PUBLIC_APP_URL is not set.');
        return;
      }
      
      const uniqueState = crypto.randomUUID();
      await saveOnboardingState(uniqueState, sessionUser._id.toString());

      const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

      // For WhatsApp onboarding, we need business_management to find the WABA later
      // The other permissions are requested by the Embedded Signup flow itself.
      const scopes = 'business_management,whatsapp_business_management,whatsapp_business_messaging' + (includeCatalog ? ',catalog_management' : '');

      const url =
        `https://www.facebook.com/v23.0/dialog/oauth` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&response_type=code` +
        `&config_id=${configId}` +
        `&state=${uniqueState}`;

      setFacebookLoginUrl(url);
    };

    setupLoginUrl();
  }, [isClient, sessionUser, appId, configId, includeCatalog, state]);


  if (!isClient || !facebookLoginUrl) {
    return (
      <Button disabled size="lg">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </Button>
    );
  }

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
