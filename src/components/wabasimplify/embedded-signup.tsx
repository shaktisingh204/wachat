'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { exchangeCodeForTokens, handleWabaOnboarding } from '@/app/actions/onboarding.actions';

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
  includeCatalog: boolean;
  onSuccess?: () => void;
}

export function EmbeddedSignup({ appId, configId, state, includeCatalog, onSuccess }: EmbeddedSignupProps) {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isProcessing, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        // Function to load the Facebook SDK script
        const loadFacebookSDK = () => {
            if (document.getElementById('facebook-jssdk')) return;

            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.async = true;
            script.defer = true;
            script.crossOrigin = "anonymous";
            document.body.appendChild(script);
        };

        // Set up the fbAsyncInit function BEFORE loading the script
        window.fbAsyncInit = function() {
            window.FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v20.0'
            });
            setIsSdkLoaded(true);
        };
        
        loadFacebookSDK();
    }, [appId]);

    const launchWhatsAppSignup = async () => {
        if (!isSdkLoaded) {
            toast({ title: 'SDK Not Ready', description: 'Facebook SDK is still loading. Please wait a moment and try again.', variant: 'destructive'});
            return;
        }

        startTransition(async () => {
            const messageHandler = async (event: MessageEvent) => {
                if (event.origin !== "https://www.facebook.com") return;
                
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'WA_EMBEDDED_SIGNUP') {
                        // This means the user has completed the flow in the popup.
                        // Now we can use the `code` to get an access token.
                        if (data.event === 'FINISH') {
                            const code = data.data.code;
                            
                            // Step 1: Exchange code for access token
                            const tokenResult = await exchangeCodeForTokens(code);
                            if (tokenResult.error || !tokenResult.accessToken) {
                                throw new Error(tokenResult.error || 'Failed to get access token.');
                            }
                            
                            // Step 2: Use the asset data from postMessage and the new token to complete onboarding
                            const onboardingResult = await handleWabaOnboarding({
                                ...data.data,
                                access_token: tokenResult.accessToken,
                            });
                            
                            if (onboardingResult.error) {
                                throw new Error(onboardingResult.error);
                            }

                            toast({ title: "Success!", description: onboardingResult.message });
                            if (onSuccess) onSuccess();
                            router.refresh();

                        } else if (data.event === 'ERROR') {
                             throw new Error(`Onboarding failed: ${data.data.message}`);
                        }
                    }
                } catch (error: any) {
                    toast({ title: "Onboarding Error", description: error.message, variant: 'destructive'});
                    console.error("Onboarding processing error:", error);
                } finally {
                    window.removeEventListener('message', messageHandler);
                }
            };

            window.addEventListener('message', messageHandler);

            let extras = {};
            if (includeCatalog) {
                extras = {
                    ...extras,
                    feature: 'CATALOG_MANAGEMENT'
                }
            }

            window.FB.login(
                function(response: any) {
                    if (!response.authResponse) {
                        // The user closed the popup or did not grant permissions.
                        window.removeEventListener('message', messageHandler);
                    }
                },
                {
                    config_id: configId,
                    response_type: 'code',
                    override_default_response_type: true,
                    state: state,
                    scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management' + (includeCatalog ? ',catalog_management' : ''),
                    extras: extras,
                }
            );
        });
    }

    return (
        <Button onClick={launchWhatsAppSignup} disabled={!isSdkLoaded || isProcessing} size="lg" className="bg-[#19D163] hover:bg-[#19D163]/90 text-white w-full">
            {isProcessing ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin"/> : <WhatsAppIcon className="mr-2 h-5 w-5" />}
            Continue with Facebook
        </Button>
    );
}
