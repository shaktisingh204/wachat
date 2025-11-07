
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InstagramIcon } from './custom-sidebar-components';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface InstagramEmbeddedSignupProps {
  appId: string;
  state: string;
}

export function InstagramEmbeddedSignup({ appId, state }: InstagramEmbeddedSignupProps) {
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
    // Scopes focused on Instagram and Facebook pages, excluding WhatsApp.
    const scopes = 'pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,business_management,pages_manage_posts,read_insights,pages_manage_engagement,pages_messaging';
    
    const facebookLoginUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    return (
        <Button asChild size="lg" className="bg-instagram hover:bg-instagram/90 w-full">
            <a href={facebookLoginUrl} target="_blank" rel="noopener noreferrer">
                <InstagramIcon className="mr-2 h-5 w-5" />
                Connect with Instagram
            </a>
        </Button>
    );
}
