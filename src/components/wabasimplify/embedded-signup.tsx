
'use client';

import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { handleWabaOnboarding } from '@/app/actions/onboarding.actions';
import Link from 'next/link';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  state: string;
  includeCatalog?: boolean;
}

export function EmbeddedSignup({ appId, configId, state, includeCatalog }: EmbeddedSignupProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
        return <Button disabled size="lg">App URL not configured</Button>;
    }
    
    if (!isClient) {
        return <Button disabled size="lg"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading...</Button>;
    }

    const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();
    
    let scope = 'whatsapp_business_management,whatsapp_business_messaging';
    if (includeCatalog) {
        scope += ',business_management,catalog_management';
    }
    
    const facebookLoginUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&config_id=${configId}&state=${state}`;

    return (
        <Button asChild size="lg" className="bg-[#19D163] hover:bg-[#19D163]/90 text-white w-full">
            <a href={facebookLoginUrl}>
                <WhatsAppIcon className="mr-2 h-5 w-5" />
                Continue with Facebook
            </a>
        </Button>
    );
}
