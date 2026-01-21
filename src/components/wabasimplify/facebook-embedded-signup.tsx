
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface FacebookEmbeddedSignupProps {
  appId: string;
  state: string;
  reauthorize?: boolean;
}

export function FacebookEmbeddedSignup({ appId, state, reauthorize = false }: FacebookEmbeddedSignupProps) {
    const [isClient, setIsClient] = React.useState(false);

    React.useEffect(() => {
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
    
    // Request a more comprehensive set of permissions for full Meta Suite functionality
    const scopes = 'pages_show_list,pages_manage_ads,pages_read_engagement,ads_management,business_management,pages_manage_posts,read_insights,pages_messaging';
    
    const facebookLoginUrl = new URL(`https://www.facebook.com/v23.0/dialog/oauth`);
    facebookLoginUrl.searchParams.set('client_id', appId);
    facebookLoginUrl.searchParams.set('redirect_uri', redirectUri);
    facebookLoginUrl.searchParams.set('scope', scopes);
    facebookLoginUrl.searchParams.set('response_type', 'code');
    facebookLoginUrl.searchParams.set('state', state);

    if (reauthorize) {
        facebookLoginUrl.searchParams.set('auth_type', 'reauthorize');
    }

    return (
        <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
            <a href={facebookLoginUrl.toString()}>
                <FacebookIcon className="mr-2 h-5 w-5" />
                {reauthorize ? 'Re-authorize Connection' : 'Connect with Facebook'}
            </a>
        </Button>
    );
}
