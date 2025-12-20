
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { getSession } from '@/app/actions/user.actions';
import { useRouter } from 'next/navigation';

interface EmbeddedSignupProps {
  includeCatalog: boolean;
}

export default function EmbeddedSignup({ includeCatalog }: EmbeddedSignupProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs to hold the data from the two async callbacks
  const wabaDataRef = useRef<{ waba_id: string; phone_number_id: string } | null>(null);
  const authCodeRef = useRef<string | null>(null);
  const sessionDataRef = useRef<{userId: string} | null>(null);

  useEffect(() => {
    // Load user session
    getSession().then(session => {
        if(session?.user) {
            sessionDataRef.current = { userId: session.user._id };
        }
    });

    // Load FB SDK
    if ((window as any).FB) {
        setIsSdkLoaded(true);
    } else {
      window.fbAsyncInit = function () {
        (window as any).FB.init({
          appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v24.0',
        });
        setIsSdkLoaded(true);
      };

      const script = document.createElement('script');
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    const messageHandler = (event: MessageEvent) => {
        if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
            return;
        }
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'WA_EMBEDDED_SIGNUP') {
                if (data.event === 'FINISH') {
                    const { phone_number_id, waba_id } = data.data;
                    wabaDataRef.current = { phone_number_id, waba_id };
                    checkAndFinalize();
                } else if (data.event === 'CANCEL') {
                    console.warn("User cancelled the Embedded Signup flow.");
                    setIsProcessing(false);
                } else if (data.event === 'ERROR') {
                    console.error("Embedded Signup Error:", data.data.error_message);
                    toast({ title: 'Onboarding Error', description: data.data.error_message, variant: 'destructive' });
                    setIsProcessing(false);
                }
            }
        } catch {
            // Ignore non-JSON messages
        }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fbLoginCallback = (response: any) => {
    if (response.authResponse) {
      authCodeRef.current = response.authResponse.code;
      checkAndFinalize();
    } else {
      console.warn('User did not complete login or did not grant permission.');
      setIsProcessing(false);
    }
  };

  const launchWhatsAppSignup = () => {
    if (!isSdkLoaded) {
        toast({title: 'SDK Not Ready', description: 'Please wait a moment for the Facebook SDK to load.', variant: 'destructive'});
        return;
    }
    if (!sessionDataRef.current?.userId) {
        toast({title: 'Not Logged In', description: 'You must be logged in to connect an account.', variant: 'destructive'});
        return;
    }

    setIsProcessing(true);
    (window as any).FB.login(fbLoginCallback, {
      config_id: process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      state: 'whatsapp',
    });
  };

  const checkAndFinalize = async () => {
    if (wabaDataRef.current && authCodeRef.current && sessionDataRef.current?.userId) {
        toast({ title: "Onboarding Complete!", description: "Finalizing account setup..." });
        
        const result = await handleWabaOnboarding({
            code: authCodeRef.current,
            wabaId: wabaDataRef.current.waba_id,
            phoneNumberId: wabaDataRef.current.phone_number_id,
            includeCatalog: includeCatalog,
            userId: sessionDataRef.current.userId
        });
        
        setIsProcessing(false);

        if (result.success) {
            toast({ title: "Setup Successful!", description: "Your project has been created.", duration: 5000 });
            router.push('/dashboard?onboarding=success');
        } else {
             toast({ title: 'Finalization Failed', description: result.error, variant: 'destructive', duration: 10000 });
        }
        
        // Reset refs
        wabaDataRef.current = null;
        authCodeRef.current = null;
    }
  };

  return (
    <Button onClick={launchWhatsAppSignup} disabled={!isSdkLoaded || isProcessing} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      {isProcessing ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <WhatsAppIcon className="mr-2 h-5 w-5" />}
      Connect with Facebook
    </Button>
  );
}
