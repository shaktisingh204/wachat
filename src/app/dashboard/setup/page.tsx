'use client';

import { useState } from 'react';

/**
 * ✅ IMPORTANT:
 * These two MUST be default imports.
 * If you use `{ EmbeddedSignup }` or `{ WhatsAppIcon }`,
 * the build WILL FAIL with "Element type is invalid".
 */
import EmbeddedSignup from '@/components/wabasimplify/embedded-signup';
import WhatsAppIcon from '@/components/wabasimplify/custom-sidebar-components';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
  const [includeCatalog, setIncludeCatalog] = useState(true);

  /**
   * ✅ Safe guard for missing env vars
   * This is CLIENT-SAFE and BUILD-SAFE
   */
  if (!appId || !configId) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <Card className="w-full max-w-2xl text-center">
        <CardHeader>
          <div className="mx-auto bg-muted p-4 rounded-full w-fit">
            <WhatsAppIcon className="h-12 w-12 text-primary" />
          </div>

          <CardTitle className="mt-4 text-2xl">
            Connect Your WhatsApp Account
          </CardTitle>

          <CardDescription>
            Securely connect your WhatsApp Business Account to start sending
            messages, managing templates, and automating conversations.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg">
                Connect WhatsApp Account
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Guided WhatsApp Setup</DialogTitle>
                <DialogDescription>
                  You will be redirected to Facebook to authorize access.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <EmbeddedSignup
                  appId={appId}
                  configId={configId}
                  includeCatalog={includeCatalog}
                  state="whatsapp"
                />

                <div className="flex items-center space-x-2 pt-2">
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
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

