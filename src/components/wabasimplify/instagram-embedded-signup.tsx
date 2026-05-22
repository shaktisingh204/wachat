'use client';

import { Button } from '@/components/zoruui';
import { useEffect, useState } from 'react';

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
        return <ZoruButton disabled size="lg">App URL not configured</ZoruButton>;
    }

    if (!isClient) {
        return <ZoruButton disabled size="lg"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading...</ZoruButton>;
    }

    const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();
    // Scopes focused on Instagram and Facebook pages, excluding WhatsApp.
    const scopes = 'pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,business_management,pages_manage_posts,read_insights,pages_manage_engagement,pages_messaging';

    const facebookLoginUrl = `/api/auth/meta-suite/login?state=${state}`;

    return (
        <ZoruButton asChild size="lg" className="bg-instagram hover:bg-instagram/90 w-full">
            <a href={facebookLoginUrl}>
                <InstagramIcon className="mr-2 h-5 w-5" />
                Connect with Instagram
            </a>
        </ZoruButton>
    );
}

