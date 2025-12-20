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
    fbAsyncInit: () => void;
  }
}

export default function EmbeddedSignup({
  appId,
  configId,
  includeCatalog,
}: EmbeddedSignupProps) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { sessionUser } = useProject();
  const { toast } = useToast();
  const router = useRouter();

  /**
   * Stores data received from Embedded Signup iframe
   * (before FB.login callback fires)
   */
  const wabaDataRef = useRef<{
    waba_id: string;
    phone_number_id: string;
  } | null>(null);

  /**
   * 🔒 ALL async logic is isolated here
   * NEVER pass async functions to FB SDK
   */
  const processOnboarding = async (
    response: any,
    wabaData: { waba_id: string; phone_number_id: string }
  ) => {
    try {
      setIsProcessing(true);

      const code = response.authResponse?.code;
      if (!code) {
        throw new Error('Authorization code missing');
      }

      const result = await finalizeOnboarding(
        sessionUser!._id.toString(),
        wabaData.waba_id,
        wabaData.phone_number_id,
        code
      );

      if (result?.error) {
        toast({
          title: 'Onboarding Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Your WhatsApp account has been connected.',
      });

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast({
        title: 'Unexpected Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 🚫 MUST NOT BE ASYNC
   * Facebook SDK requires a plain function
   */
  const fbLoginCallback = useCallback((response: any) => {
    if (!response?.authResponse) {
      toast({
        title: 'Login Cancelled',
        description: 'Facebook login was not completed.',
        variant: 'destructive',
      });
      return;
    }

    if (!wabaDataRef.current) {
      toast({
        title: 'Signup Incomplete',
        description: 'Missing WhatsApp account data.',
        variant: 'destructive',
      });
      return;
    }

    processOnboarding(response, wabaDataRef.current);
  }, []);

  /**
   * Launch Facebook Embedded Signup
   */
  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      console.error('Facebook SDK not loaded');
      return;
    }

    window.FB.login(fbLoginCallback, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      scope:
        'whatsapp_business_management,whatsapp_business_messaging' +
        (includeCatalog
          ? ',catalog_management,business_management'
          : ''),
    });
  };

  /**
   * Listen for Embedded Signup postMessage events
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data =
          typeof event.data === 'string'
            ? JSON.parse(event.data)
            : event.data;

        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          const { phone_number_id, waba_id } = data.data || {};
          if (phone_number_id && waba_id) {
            wabaDataRef.current = { phone_number_id, waba_id };
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Load Facebook SDK
   */
  useEffect(() => {
    if (window.FB) {
      setIsSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId,
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
  }, [appId]);

  /**
   * UI States
   */
  if (!isSdkLoaded || isProcessing) {
    return (
      <Button disabled size="lg" className="w-full">
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
