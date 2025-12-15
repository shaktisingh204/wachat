
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exchangeCodeForTokens, handleWabaOnboarding } from '@/app/actions/whatsapp.actions';

interface EmbeddedSignupProps {
    appId: string;
    configId: string;
    includeCatalog?: boolean;
}

export function EmbeddedSignup({ appId, configId, includeCatalog = false }: EmbeddedSignupProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isProcessing, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    // Load the Facebook SDK script
    useEffect(() => {
        if (document.getElementById('facebook-jssdk')) {
            setIsSdkLoaded(true);
            return;
        }

        window.fbAsyncInit = function () {
            window.FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v20.0',
            });
            window.FB.AppEvents.logPageView();
            setIsSdkLoaded(true);
        };

        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [appId]);

    // Handle the postMessage event from the popup
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== 'https://www.facebook.com') return;
            
            const data = event.data;
            if (data?.type === 'WA_EMBEDDED_SIGNUP') {
                if (data.event === 'FINISH') {
                    startTransition(async () => {
                        const { wabas, phone_numbers, business_id, granted_scopes, access_token } = data.data;
                        const result = await handleWabaOnboarding({ wabas, phone_numbers, business_id, granted_scopes, access_token });
                        
                        if (result.success) {
                            toast({ title: "Connection Successful!", description: result.message });
                            router.push('/dashboard');
                            router.refresh();
                        } else {
                            toast({ title: 'Onboarding Error', description: result.error, variant: 'destructive' });
                        }
                    });
                } else if (data.event === 'CLOSE') {
                    console.log('Embedded signup popup was closed by the user.');
                } else if (data.event === 'ERROR') {
                    console.error('Embedded signup error:', data.data);
                    toast({ title: 'Connection Error', description: `An error occurred: ${data.data?.message}`, variant: 'destructive' });
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [toast, router]);


    const launchWhatsAppSignup = () => {
        if (!isSdkLoaded || !window.FB) {
            toast({ title: 'SDK Not Ready', description: 'Please wait a moment for the Facebook SDK to load.', variant: 'destructive' });
            return;
        }
        
        window.FB.login(
            (response: any) => {
                if (response.authResponse && response.authResponse.code) {
                    startTransition(async () => {
                        const { accessToken, error } = await exchangeCodeForTokens(response.authResponse.code);
                        if (error) {
                            toast({ title: 'Token Exchange Failed', description: error, variant: 'destructive' });
                        }
                        // The actual onboarding data is handled by the 'message' event listener.
                        // The token from the `code` is implicitly used by the popup to send us the data.
                    });
                } else {
                    console.log('User cancelled login or did not fully authorize.');
                }
            },
            {
                config_id: configId,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    feature: 'whatsapp_embedded_signup',
                    version: '2',
                    session_info_version: '2',
                    setup: {
                        ...(includeCatalog && { catalog: { create: true } }),
                    },
                },
            }
        );
    };

    return (
        <Button onClick={launchWhatsAppSignup} size="lg" className="bg-[#25D366] hover:bg-[#25D366]/90 text-white w-full" disabled={!isSdkLoaded || isProcessing}>
            {isProcessing ? (
                <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>
            ) : (
                <WhatsAppIcon className="mr-2 h-5 w-5" />
            )}
            {isProcessing ? 'Processing...' : 'Connect with Facebook'}
        </Button>
    );
}

    