import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruCheckbox,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useState } from 'react';

/**
 * ✅ FIX: EmbeddedSignup is a DEFAULT export
 * DO NOT use `{ EmbeddedSignup }`
 */
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';

import { AlertCircle } from 'lucide-react';

'use client';

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
  const [includeCatalog, setIncludeCatalog] = useState(true);

  /**
   * ✅ Build-safe env guard
   */
  if (!appId || !configId) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <ZoruAlert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Configuration Error</ZoruAlertTitle>
          <ZoruAlertDescription className="space-y-2">
            <p>
              The following environment variables are missing:
            </p>
            <ul className="list-disc list-inside text-xs">
              <li>NEXT_PUBLIC_META_ONBOARDING_APP_ID</li>
              <li>NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</li>
            </ul>
            <p className="text-xs mt-2">
              Please configure them in your <code>.env</code> file.
            </p>
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 items-center px-4">
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl font-bold font-headline">
          Connect Your WhatsApp Account
        </h1>
        <p className="text-muted-foreground mt-2">
          Use our guided setup to securely connect your WhatsApp Business Account.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <ZoruCard className="flex flex-col text-center card-gradient card-gradient-green">
          <ZoruCardHeader>
            <ZoruCardTitle>Guided Setup (Recommended)</ZoruCardTitle>
            <ZoruCardDescription>
              Use the secure pop-up to connect your account in a few clicks.
            </ZoruCardDescription>
          </ZoruCardHeader>

          <ZoruCardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6">
            <EmbeddedSignup
              appId={appId}
              configId={configId}
              includeCatalog={includeCatalog}
              state="whatsapp"
            />

            <p className="text-xs text-muted-foreground">
              You will be redirected to Facebook to authorize the connection.
            </p>
          </ZoruCardContent>

          <ZoruCardFooter>
            <div className="flex items-center space-x-2">
              <ZoruCheckbox
                id="include-catalog"
                checked={includeCatalog}
                onCheckedChange={(checked) =>
                  setIncludeCatalog(Boolean(checked))
                }
              />
              <ZoruLabel
                htmlFor="include-catalog"
                className="text-sm font-normal"
              >
                Include permissions for Catalog Management
              </ZoruLabel>
            </div>
          </ZoruCardFooter>
        </ZoruCard>
      </div>
    </div>
  );
}

