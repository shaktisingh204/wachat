
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
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
  state
}: EmbeddedSignupProps) {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { sessionUser } = useProject();
  const { toast } = useToast();
  const router = useRouter();

  // Refs to store the async data
  const wabaIdRef = useRef<string | null>(null);
  const authCodeRef = useRef<string | null>(null);

  // This function will be called when both pieces of data are ready
  const finalizeOnboarding = useCallback(async () => {
    if (wabaIdRef.current && authCodeRef.current && sessionUser?._id) {
        setIsProcessing(true);
        const result = await handleWabaOnboarding(
            authCodeRef.current,
            wabaIdRef.current,
            includeCatalog,
            sessionUser._id
        );

        setIsProcessing(false);
        if (result.success) {
            toast({ title: 'Success!', description: 'WhatsApp account connected successfully.' });
            router.push('/dashboard');
        } else {
            toast({ title: 'Onboarding Failed', description: result.error, variant: 'destructive' });
        }
        
        // Reset for next attempt
        wabaIdRef.current = null;
        authCodeRef.current = null;
    }
  }, [sessionUser?._id, includeCatalog, router, toast]);

  useEffect(() => {
    // Define the fbAsyncInit function on the window object
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v23.0',
      });
      setIsSdkLoaded(true);
    };

    // Load the SDK script
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { return; }
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs?.parentNode?.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));

    // Setup the message listener
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH' && data.data) {
            wabaIdRef.current = data.data.waba_id;
            console.log("Received WABA ID:", wabaIdRef.current);
            // If code is already here, finalize
            if (authCodeRef.current) {
                finalizeOnboarding();
            }
          } else if (data.event === 'CANCEL') {
            console.warn("User cancelled at step:", data.data.current_step);
          } else if (data.event === 'ERROR') {
             console.error("Embedded signup error:", data.data.error_message);
             toast({ title: 'Connection Error', description: data.data.error_message, variant: 'destructive'});
          }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [appId, finalizeOnboarding, toast]);

  const fbLoginCallback = (response: any) => {
    if (response.authResponse && response.authResponse.code) {
      authCodeRef.current = response.authResponse.code;
      console.log("Received auth code:", authCodeRef.current);
      // If WABA ID is already here, finalize
      if (wabaIdRef.current) {
          finalizeOnboarding();
      }
    } else {
        console.error("Facebook login failed or did not return an auth code.");
        toast({ title: 'Login Failed', description: 'Could not get authorization from Facebook.', variant: 'destructive'});
    }
  };

  const launchWhatsAppSignup = () => {
    if (!isSdkLoaded) {
      console.error("Facebook SDK not loaded yet.");
      return;
    }
    window.FB.login(fbLoginCallback, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      state: `${state}-${sessionUser?._id}`,
      scope: 'whatsapp_business_management,whatsapp_business_messaging' +
        (includeCatalog ? ',catalog_management,business_management' : '')
    });
  };

  const buttonDisabled = !isSdkLoaded || isProcessing;

  return (
    <Button onClick={launchWhatsAppSignup} disabled={buttonDisabled} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      {isProcessing ? (
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>
      ) : (
        <WhatsAppIcon className="mr-2 h-5 w-5" />
      )}
      {isProcessing ? 'Finalizing...' : 'Connect with Facebook'}
    </Button>
  );
}
