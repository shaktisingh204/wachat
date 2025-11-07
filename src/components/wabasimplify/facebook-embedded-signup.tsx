
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface FacebookEmbeddedSignupProps {
  appId: string;
  state: string;
  configId: string;
  projectId?: string;
  onSuccess?: () => void;
}

export function FacebookEmbeddedSignup({ appId, state, configId, projectId, onSuccess }: FacebookEmbeddedSignupProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== 'https://www.facebook.com') return;
            if (event.data?.type === 'WA_EMBEDDED_SIGNUP') {
                if (event.data.event === 'FINISH') {
                    onSuccess?.();
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onSuccess]);
    
    useEffect(() => {
        if (!isClient) return;

        // @ts-ignore
        if (window.FB) {
             // @ts-ignore
            window.FB.XFBML.parse();
        } else {
            const script = document.createElement('script');
            script.src = "https://connect.facebook.net/en_US/sdk.js";
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                 // @ts-ignore
                window.FB.init({
                    appId: appId,
                    cookie: true,
                    xfbml: true,
                    version: 'v23.0'
                });
            };
            document.body.appendChild(script);
        }
    }, [isClient, appId]);

    const handleLogin = () => {
         // @ts-ignore
        if (window.FB) {
             // @ts-ignore
            window.FB.login(function(response: any) {
                if (response.authResponse) {
                    // User is logged in and has authorized the app
                    // Now, you can use FB.ui for embedded signup
                     // @ts-ignore
                    window.FB.ui({
                        display: 'popup',
                        method: 'whatsapp_embedded_signup',
                        config_id: configId,
                        override_default_response_type: true,
                        response_type: 'code',
                        state: projectId ? `project:${projectId}` : 'new',
                    });
                } else {
                    // User cancelled login or did not fully authorize
                    console.log('User cancelled login or did not fully authorize.');
                }
            }, {
                scope: 'business_management,pages_manage_ads,pages_manage_metadata,pages_read_engagement,ads_management,whatsapp_business_management,whatsapp_business_messaging',
                extras: {
                    feature: 'whatsapp_embedded_signup',
                    setup: {
                        ...projectId && {business_id: projectId}
                    }
                }
            });
        }
    };
    
    if (!isClient) {
        return <Button disabled size="lg"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading...</Button>;
    }
    
    return (
        <Button onClick={handleLogin} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
            <FacebookIcon className="mr-2 h-5 w-5" />
            Connect with Facebook
        </Button>
    );
}

