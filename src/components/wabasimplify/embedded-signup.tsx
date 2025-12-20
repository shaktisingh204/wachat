
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { finalizeOnboarding } from '@/app/actions/onboarding.actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  state: 'whatsapp' | 'facebook';
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

export default function EmbeddedSignup({
  appId,
  configId,
  includeCatalog,
  state,
}: EmbeddedSignupProps) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { sessionUser } = useProject();
  const { toast } = useToast();
  const router = useRouter();

  const wabaDataRef = useRef<{ waba_id: string; phone_number_id: string } | null>(null);

  const fbLoginCallback = useCallback(async (response: any) => {
    setIsProcessing(true);
    if (response.authResponse && wabaDataRef.current) {
      const code = response.authResponse.code;
      const { waba_id, phone_number_id } = wabaDataRef.current;

      const result = await finalizeOnboarding(
        sessionUser!._id.toString(),
        waba_id,
        phone_number_id,
        code
      );

      if (result.error) {
        toast({ title: 'Onboarding Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success!', description: 'Your WhatsApp account has been connected.' });
        router.push('/dashboard');
        router.refresh();
      }
    } else {
      toast({ title: 'Onboarding Incomplete', description: 'Could not get required permissions or data. Please try again.', variant: 'destructive' });
    }
    setIsProcessing(false);
  }, [sessionUser, toast, router]);

  const launchWhatsAppSignup = useCallback(() => {
    if (!window.FB) {
      console.error('Facebook SDK not loaded.');
      return;
    }
    window.FB.login(fbLoginCallback, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      scope: 'whatsapp_business_management,whatsapp_business_messaging' + (includeCatalog ? ',catalog_management,business_management' : ''),
    });
  }, [configId, includeCatalog, fbLoginCallback]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;
            wabaDataRef.current = { waba_id, phone_number_id };
          }
        }
      } catch (e) {
        console.warn('Non JSON response from parent window');
      }
    };

    window.addEventListener('message', handleMessage);

    if (window.FB) {
      setIsSdkLoaded(true);
    } else {
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v23.0',
        });
        setIsSdkLoaded(true);
      };

      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [appId]);

  if (!isSdkLoaded || isProcessing) {
    return (
      <Button disabled size="lg">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        {isProcessing ? 'Finalizing...' : 'Loading...'}
      </Button>
    );
  }

  return (
    <Button
      onClick={launchWhatsAppSignup}
      size="lg"
      className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full"
    >
      <WhatsAppIcon className="mr-2 h-5 w-5" />
      Connect with Facebook
    </Button>
  );
}
