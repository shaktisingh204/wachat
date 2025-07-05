

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from './custom-sidebar-components';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';

interface FacebookEmbeddedSignupProps {
  appId: string;
  onSuccess: () => void;
  // configId is no longer needed for this flow
  configId: string;
}

export function FacebookEmbeddedSignup({ appId }: FacebookEmbeddedSignupProps) {
    const [redirectUri, setRedirectUri] = useState('');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (typeof window !== 'undefined') {
            setRedirectUri(`${window.location.origin}/auth/facebook/callback`);
        }
    }, []);

    if (!isClient) {
        return <Button disabled size="lg"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading...</Button>;
    }

    const scopes = 'pages_show_list,pages_read_engagement,business_management,pages_manage_posts,read_insights,pages_manage_engagement';
    const facebookLoginUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

    return (
        <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full" disabled={!redirectUri}>
            <Link href={facebookLoginUrl}>
                <FacebookIcon className="mr-2 h-5 w-5" />
                Connect with Facebook
            </Link>
        </Button>
    );
}

    