
'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  state: string;
  includeCatalog?: boolean;
  onSuccess?: () => void;
}

export function EmbeddedSignup({ appId, configId, state, includeCatalog, onSuccess }: EmbeddedSignupProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isProcessing, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const [wabaData, setWabaData] = useState<any>(null);
    const [authCode, setAuthCode] = useState<string | null>(null);

    // This is the key change: a useEffect hook that triggers the server action only when BOTH pieces of data are available.
    useEffect(() => {
        if (wabaData && authCode) {
            startTransition(async () => {
                try {
                    const result = await handleWabaOnboarding({
                        ...wabaData,
                        code: authCode,
                    });

                    if (result.error) throw new Error(result.error);

                    toast({ title: "Success!", description: result.message });
                    if (onSuccess) onSuccess();
                    router.push('/dashboard');
                } catch (e: any) {
                    setError(e.message || 'An unknown error occurred during setup.');
                }
            });
        }
    }, [wabaData, authCode, onSuccess, router, toast]);

    // Sets up the message listener for WABA data
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== "https://www.facebook.com") return;
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH') {
                        setWabaData(data.data); // Store the WABA data in state
                    } else if (data.event === 'ERROR') {
                        setError(data.data.message || 'An error occurred during onboarding.');
                    }
                }
            } catch (e) {}
        };
        
        window.addEventListener('message', handleMessage);
        
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // Initializes the Facebook SDK
    useEffect(() => {
        if (window.FB) {
            setIsSdkLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        document.body.appendChild(script);
        
        window.fbAsyncInit = function() {
            window.FB.init({ appId, cookie: true, xfbml: true, version: 'v23.0' });
            setIsSdkLoaded(true);
        };
    }, [appId]);

    const launchWhatsAppSignup = () => {
        if (!isSdkLoaded) {
            toast({ title: 'SDK Not Ready', description: 'Facebook SDK is still loading. Please wait a moment and try again.', variant: 'destructive'});
            return;
        }

        setError(null);
        setWabaData(null);
        setAuthCode(null);

        // The FB.login callback now ONLY sets the auth code.
        // The useEffect hook will handle the rest.
        const loginCallback = (response: any) => {
            if (response.authResponse && response.authResponse.code) {
                setAuthCode(response.authResponse.code);
            } else {
                setError('Onboarding cancelled or permissions not granted.');
            }
        };

        window.FB.login(loginCallback, {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            state: state,
            scope: 'whatsapp_business_management,whatsapp_business_messaging' + (includeCatalog ? ',business_management,catalog_management' : ''),
        });
    };

    return (
        <div className="w-full space-y-4">
             {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Onboarding Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <Button onClick={launchWhatsAppSignup} disabled={!isSdkLoaded || isProcessing} size="lg" className="bg-[#19D163] hover:bg-[#19D163]/90 text-white w-full">
                {isProcessing ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/> : <WhatsAppIcon className="mr-2 h-5 w-5" />}
                Continue with Facebook
            </Button>
        </div>
    );
}
