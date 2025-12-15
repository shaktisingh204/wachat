'use client';

import { useState } from 'react';

/**
 * ✅ FIX: EmbeddedSignup is a DEFAULT export
 * DO NOT use `{ EmbeddedSignup }`
 */
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
        <Alert variant="destructive" className="max-w-lg w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription className="space-y-2">
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
          </AlertDescription>
        </Alert>
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
        <Card className="flex flex-col text-center card-gradient card-gradient-green">
          <CardHeader>
            <CardTitle>Guided Setup (Recommended)</CardTitle>
            <CardDescription>
              Use the secure pop-up to connect your account in a few clicks.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6">
            <EmbeddedSignup
              appId={appId}
              configId={configId}
              includeCatalog={includeCatalog}
              state="whatsapp"
            />

            <p className="text-xs text-muted-foreground">
              You will be redirected to Facebook to authorize the connection.
            </p>
          </CardContent>

          <CardFooter>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-catalog"
                checked={includeCatalog}
                onCheckedChange={(checked) =>
                  setIncludeCatalog(Boolean(checked))
                }
              />
              <Label
                htmlFor="include-catalog"
                className="text-sm font-normal"
              >
                Include permissions for Catalog Management
              </Label>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

