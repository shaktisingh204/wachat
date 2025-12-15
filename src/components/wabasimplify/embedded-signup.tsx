
'use client';

import React, { useEffect, useState, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

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
    
    // Using refs to hold the results from the two separate async events
    const wabaDataRef = useRef<any>(null);
    const authCodeRef = useRef<string | null>(null);

    useEffect(() => {
        // Function to process onboarding once both pieces of data are available
        const processOnboarding = () => {
            if (wabaDataRef.current && authCodeRef.current) {
                startTransition(async () => {
                    try {
                        const result = await handleWabaOnboarding({
                            ...wabaDataRef.current,
                            code: authCodeRef.current,
                        });

                        if (result.error) throw new Error(result.error);

                        toast({ title: "Success!", description: result.message });
                        if (onSuccess) onSuccess();
                        router.push('/dashboard');
                        router.refresh();

                    } catch (e: any) {
                        setError(e.message || 'An unknown error occurred during setup.');
                    }
                });
            }
        };

        // If data arrives, check if the other part is also ready
        if (wabaDataRef.current || authCodeRef.current) {
            processOnboarding();
        }

    }, [isProcessing, onSuccess, router, toast]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== "https://www.facebook.com") return;
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH') {
                        wabaDataRef.current = data.data;
                         if (authCodeRef.current) {
                            startTransition(() => {
                                handleWabaOnboarding({ ...wabaDataRef.current, code: authCodeRef.current! }).then(result => {
                                    if (result.error) throw new Error(result.error);
                                    toast({ title: "Success!", description: result.message });
                                    if (onSuccess) onSuccess();
                                    router.push('/dashboard');
                                });
                            });
                        }
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
    }, [onSuccess, router, toast]);

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
        wabaDataRef.current = null;
        authCodeRef.current = null;

        const loginCallback = (response: any) => {
            if (response.authResponse && response.authResponse.code) {
                authCodeRef.current = response.authResponse.code;
                if (wabaDataRef.current) {
                     startTransition(() => {
                        handleWabaOnboarding({ ...wabaDataRef.current, code: authCodeRef.current! }).then(result => {
                            if (result.error) throw new Error(result.error);
                            toast({ title: "Success!", description: result.message });
                            if (onSuccess) onSuccess();
                            router.push('/dashboard');
                        });
                    });
                }
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

