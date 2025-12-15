
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  state: 'whatsapp' | 'facebook';
  onSuccess?: () => void;
}

export default function EmbeddedSignup({ appId, configId, includeCatalog, state }: EmbeddedSignupProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
        console.error("NEXT_PUBLIC_APP_URL is not set.");
        return <Button disabled size="lg">App URL not configured</Button>;
    }
    
    if (!isClient) {
        return <Button disabled size="lg"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading...</Button>;
    }

    const redirectUri = `https://sabnode.com/auth/facebook/callback`;

    let scopes = 'whatsapp_business_management,whatsapp_business_messaging';
    if (includeCatalog) {
        scopes += ',catalog_management,business_management';
    }

    const facebookLoginUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&config_id=${configId}&state=${state}`;

    return (
        <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
            <a href={facebookLoginUrl}>
                <WhatsAppIcon className="mr-2 h-5 w-5" />
                Connect with Facebook
            </a>
        </Button>
    );
}
