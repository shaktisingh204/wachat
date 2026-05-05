'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { InstagramEmbeddedSignup } from '@/components/wabasimplify/instagram-embedded-signup';
import { ManualInstagramSetupDialog } from '@/components/wabasimplify/manual-instagram-setup-dialog';

export default function InstagramSetupPage() {
  const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;

  if (!appId) {
    return (
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Configuration Error</ZoruAlertTitle>
        <ZoruAlertDescription>
          <p>NEXT_PUBLIC_INSTAGRAM_APP_ID must be set in your .env file.</p>
          <p className="mt-2 text-xs">
            Please contact the system administrator to configure the integration correctly.
          </p>
        </ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  return (
    <div className="flex flex-col gap-8 items-center">
      <div className="text-center max-w-3xl">
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Connect Your Instagram Account</ZoruPageTitle>
            <ZoruPageDescription>
              Choose your preferred method to connect your Instagram Business Account. We
              recommend the guided setup for most users.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <ZoruCard className="flex flex-col text-center p-6">
          <ZoruCardHeader>
            <ZoruCardTitle>Guided Setup (Recommended)</ZoruCardTitle>
            <ZoruCardDescription>
              Use the secure pop-up to connect your account in a few clicks.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6">
            <InstagramEmbeddedSignup appId={appId} state="instagram" />
            <p className="text-xs text-zoru-ink-muted">
              You will be redirected to Facebook to authorize the connection.
            </p>
          </ZoruCardContent>
        </ZoruCard>
        <ManualInstagramSetupDialog />
      </div>
    </div>
  );
}
