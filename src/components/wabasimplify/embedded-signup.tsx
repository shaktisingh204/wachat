
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
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
}

export function EmbeddedSignup({ appId, configId, state, includeCatalog }: EmbeddedSignupProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'WA_EMBEDDED_SIGNUP') {
                if (event.data.event === 'FINISH') {
                    localStorage.setItem('wabaData', JSON.stringify(event.data.data));
                } else if (event.data.event === 'ERROR') {
                    setError(event.data.data.message || 'An error occurred during onboarding.');
                    setIsProcessing(false);
                }
            }

            if (event.data === 'WABASimplifyOnboardingSuccess') {
                toast({ title: "Onboarding Successful!", description: "Your WhatsApp Business Account is connected." });
                setIsProcessing(false);
                router.push('/dashboard');
                router.refresh();
            }

            if (event.data && event.data.type === 'WABASimplifyOnboardingError') {
                 setError(event.data.error || 'An unknown error occurred during final setup.');
                 setIsProcessing(false);
            }
        };
        
        window.addEventListener('message', handleMessage);
        
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [router, toast]);

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
        localStorage.removeItem('wabaData');

        const redirectUri = new URL('/auth/facebook/callback', window.location.origin).toString();

        window.FB.login(() => {
            // This callback is triggered when the popup closes.
            // The actual logic is now handled by the callback page and postMessage listener.
            // A timeout helps detect if the flow was abandoned without a redirect.
            setTimeout(() => {
                 if (isProcessing) {
                    // If still processing after 5s, likely user closed popup manually
                    setIsProcessing(false);
                 }
            }, 5000);
        }, {
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
            <Button onClick={launchWhatsAppSignup} disabled={!isSdkLoaded || isProcessing} size="lg" className="bg-[#19D163] hover:bg-[#19D163]/90 text-white w-full">
                {isProcessing ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/> : <WhatsAppIcon className="mr-2 h-5 w-5" />}
                Continue with Facebook
            </Button>
        </div>
    );
}
