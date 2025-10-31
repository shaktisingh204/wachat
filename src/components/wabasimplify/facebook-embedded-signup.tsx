
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface FacebookEmbeddedSignupProps {
  appId: string;
  state: string;
}

export function FacebookEmbeddedSignup({ appId, state }: FacebookEmbeddedSignupProps) {
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
    const scopes = 'pages_show_list,pages_read_engagement,business_management,pages_manage_posts,read_insights,pages_manage_engagement';
    
    const facebookLoginUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    return (
        <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
            <Link href={facebookLoginUrl}>
                <FacebookIcon className="mr-2 h-5 w-5" />
                Connect with Facebook
            </Link>
        </Button>
    );
}
