
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface EmbeddedSignupProps {
  appId: string;
  state: string;
}

export function EmbeddedSignup({ appId, state }: EmbeddedSignupProps) {
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
    
    const scopes = 'whatsapp_business_management,whatsapp_business_messaging,business_management';
    
    const facebookLoginUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    return (
        <Button asChild size="lg" className="bg-[#25D366] hover:bg-[#25D366]/90 text-white w-full">
            <a href={facebookLoginUrl}>
                <WhatsAppIcon className="mr-2 h-5 w-5" />
                Connect with Facebook
            </a>
        </Button>
    );
}
