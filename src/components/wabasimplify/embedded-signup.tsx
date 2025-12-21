
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';
import Link from 'next/link';

interface EmbeddedSignupProps {
  includeCatalog: boolean;
}

export default function EmbeddedSignup({ includeCatalog }: EmbeddedSignupProps) {
  // The component now renders a simple link to our server endpoint,
  // which will handle the redirect to Facebook. This is a more robust
  // server-side OAuth flow.
  const authUrl = `/api/auth/facebook/login?includeCatalog=${includeCatalog}`;

  return (
    <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      <Link href={authUrl}>
        <WhatsAppIcon className="mr-2 h-5 w-5" />
        Connect with Facebook
      </Link>
    </Button>
  );
}
