
'use client';

import React from 'react';
import { ZoruButton, ZoruButton } from '@/components/zoruui';
import { WhatsAppIcon } from './custom-sidebar-components';
import Link from 'next/link';

interface EmbeddedSignupProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  state: string;
  reauthorize?: boolean;
}

export default function EmbeddedSignup({ appId, configId, includeCatalog, state, reauthorize = false }: EmbeddedSignupProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return <ZoruButton disabled size="lg">App URL not configured</ZoruButton>;
  }

  const authUrl = `/api/auth/facebook/login?includeCatalog=${includeCatalog}&state=${state}${reauthorize ? '&reauthorize=true' : ''}`;

  return (
    <ZoruButton asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      <Link href={authUrl}>
        <WhatsAppIcon className="mr-2 h-5 w-5" />
        {reauthorize ? 'Re-authorize with Facebook' : 'Connect with Facebook'}
      </Link>
    </ZoruButton>
  );
}
