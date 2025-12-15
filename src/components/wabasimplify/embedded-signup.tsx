
'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';

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
}

export function EmbeddedSignup({ appId, configId, state, includeCatalog }: EmbeddedSignupProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const [authCode, setAuthCode] = useState<string | null>(null);
    const [wabaData, setWabaData] = useState<any | null>(null);
    const [isServerActionPending, startServerActionTransition] = useTransition();

    const callServerAction = useCallback((code: string, data: any) => {
        console.log("[EMBEDDED] Calling server action with code and WABA data.");
        startServerActionTransition(async () => {
            const result = await handleWabaOnboarding({ ...data, code });
            if (result.error) {
                setError(result.error);
                setIsProcessing(false);
            } else {
                toast({ title: "Onboarding Successful!", description: "Your WhatsApp Business Account is connected." });
                setIsProcessing(false);
                router.push('/dashboard');
                router.refresh();
            }
        });
    }, [router, toast]);

    useEffect(() => {
        if (authCode && wabaData) {
            callServerAction(authCode, wabaData);
        }
    }, [authCode, wabaData, callServerAction]);


    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'WA_EMBEDDED_SIGNUP') {
                 if (event.data.event === 'FINISH') {
                    console.log("[EMBEDDED] postMessage 'FINISH' event received with data:", event.data.data);
                    setWabaData(event.data.data);
                } else if (event.data.event === 'ERROR') {
                    console.error("[EMBEDDED] postMessage 'ERROR' event received:", event.data.data);
                    setError(event.data.data.message || 'An error occurred during the onboarding flow.');
                    setIsProcessing(false);
                }
            }
        };
        
        window.addEventListener('message', handleMessage);
        
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    useEffect(() => {
        if (document.getElementById('facebook-jssdk')) {
            if (window.FB) {
                setIsSdkLoaded(true);
            }
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
            console.log("[EMBEDDED] Facebook SDK initialized.");
        };

        return () => {
            const sdkScript = document.getElementById('facebook-jssdk');
            if (sdkScript) {
                try {
                    document.body.removeChild(sdkScript);
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
        }
    }, [appId]);

    const launchWhatsAppSignup = () => {
        if (!isSdkLoaded) {
            toast({ title: 'SDK Not Ready', description: 'Facebook SDK is still loading. Please wait a moment and try again.', variant: 'destructive'});
            return;
        }

        setError(null);
        setIsProcessing(true);
        setAuthCode(null);
        setWabaData(null);

        // **DEFINITIVE FIX**: Use the hardcoded, correct redirect URI.
        const redirectUri = 'https://sabnode.com/auth/facebook/callback';

        const fbLoginCallback = (response: any) => {
            console.log("[EMBEDDED] FB.login callback fired.");
            if (response.authResponse && response.authResponse.code) {
                 console.log("[EMBEDDED] Authorization code received from FB.login callback.");
                 setAuthCode(response.authResponse.code);
            } else {
                console.error("[EMBEDDED] FB.login failed or was cancelled.", response);
                setError("Login failed or was cancelled by user.");
                setIsProcessing(false);
            }
        }

        window.FB.login(fbLoginCallback, {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            state: state,
            redirect_uri: redirectUri,
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
            <Button onClick={launchWhatsAppSignup} disabled={!isSdkLoaded || isProcessing || isServerActionPending} size="lg" className="bg-[#19D163] hover:bg-[#19D163]/90 text-white w-full">
                {(isProcessing || isServerActionPending) ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/> : <WhatsAppIcon className="mr-2 h-5 w-5" />}
                Continue with Facebook
            </Button>
        </div>
    );
}
