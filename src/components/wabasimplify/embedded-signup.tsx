
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from './custom-sidebar-components';

interface EmbeddedSignupProps {
  includeCatalog: boolean;
}

export default function EmbeddedSignup({ includeCatalog }: EmbeddedSignupProps) {
  // The component now simply links to our own API route to start the process.
  // This is a more robust server-side OAuth flow.
  const startOnboarding = () => {
    // We pass the catalog preference in the URL for the server to use.
    window.location.href = `/api/auth/facebook/login?includeCatalog=${includeCatalog}`;
  };

  return (
    <Button onClick={startOnboarding} size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
      <WhatsAppIcon className="mr-2 h-5 w-5" />
      Connect with Facebook
    </Button>
  );
}
