'use client';

import { Card, CardBody, CardHeader, CardTitle, CardDescription, CardFooter, Alert, AlertDescription, AlertTitle, Checkbox, Label, Progress } from '@/components/sabcrm/20ui';
import { useState } from 'react';

/**
 * ✅ FIX: EmbeddedSignup is a DEFAULT export
 * DO NOT use `{ EmbeddedSignup }`
 */
import EmbeddedSignup from '@/components/20ui-domain/embedded-signup';

import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
  const [includeCatalog, setIncludeCatalog] = useState(true);

  /**
   * ✅ Build-safe env guard
   */
  if (!appId || !configId) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <Card className="max-w-2xl w-full border-[var(--st-danger)]/20 shadow-lg">
          <CardHeader className="bg-[var(--st-text)]/5 border-b border-destructive/10 pb-6">
            <CardTitle className="flex items-center gap-2 text-[var(--st-danger)] text-xl">
              <AlertCircle className="h-6 w-6" />
              Meta Configuration Required
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Your Meta Embedded Signup environment variables are missing. Follow these steps to configure them and enable WhatsApp Business Account connections.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-8 pt-8">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)] font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-lg">Create a Meta App</h3>
                  <p className="text-[var(--st-text-secondary)] mt-1 leading-relaxed">Go to the Meta App Dashboard, create a Business App, and add the WhatsApp product to your app.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)] font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-lg">Get your App ID</h3>
                  <p className="text-[var(--st-text-secondary)] mt-1 leading-relaxed">Find your App ID at the top of the App Dashboard. Add this as <code className="bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded text-sm font-mono border">NEXT_PUBLIC_META_ONBOARDING_APP_ID</code> in your <code className="bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded text-sm font-mono border">.env</code> file.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-[var(--st-text)] font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-lg">Create a Configuration ID</h3>
                  <p className="text-[var(--st-text-secondary)] mt-1 leading-relaxed">In the WhatsApp product settings, go to "Embedded Signup", create a configuration, and copy the Configuration ID. Add this as <code className="bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded text-sm font-mono border">NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</code> in your <code className="bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded text-sm font-mono border">.env</code> file.</p>
                </div>
              </div>
            </div>
            
            <Alert variant="default" className="bg-[var(--st-bg-secondary)]/50 border-[var(--st-text)]/20">
              <AlertCircle className="h-4 w-4 text-[var(--st-text)]" />
              <AlertTitle className="text-[var(--st-text)] font-semibold">Restart Required</AlertTitle>
              <AlertDescription>
                After updating your <code className="bg-[var(--st-bg)] px-1 py-0.5 rounded text-xs border">.env</code> file, remember to restart your Next.js development server to apply the changes.
              </AlertDescription>
            </Alert>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-4xl">
        
        {/* Setup Progress Tracking */}
        <div className="mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[var(--st-bg-secondary)] rounded-full overflow-hidden z-0">
              <div className="h-full bg-[var(--st-text)] w-[15%] transition-all duration-500 ease-in-out"></div>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-[var(--st-bg)] px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-text)] text-[var(--st-text-inverted)] font-bold shadow-md ring-4 ring-background">
                1
              </div>
              <span className="text-sm font-semibold mt-3">Connect</span>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-[var(--st-bg)] px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] font-bold ring-4 ring-background">
                2
              </div>
              <span className="text-sm font-medium mt-3 text-[var(--st-text-secondary)]">Configure</span>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-[var(--st-bg)] px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] font-bold ring-4 ring-background">
                3
              </div>
              <span className="text-sm font-medium mt-3 text-[var(--st-text-secondary)]">Ready</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold font-headline tracking-tight">
            Connect Your WhatsApp Account
          </h1>
          <p className="text-[var(--st-text-secondary)] mt-3 text-lg max-w-2xl mx-auto">
            Use our guided setup to securely connect your WhatsApp Business Account to begin sending and receiving messages.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto">
          <Card className="flex flex-col text-center shadow-lg border-[var(--st-text)]/20 overflow-hidden">
            <div className="h-2 bg-[var(--st-text)] w-full"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Guided Setup</CardTitle>
              <CardDescription className="text-base">
                We recommend using the secure pop-up to connect your account in a few clicks.
              </CardDescription>
            </CardHeader>

            <CardBody className="flex-grow flex flex-col items-center justify-center text-center gap-6 py-6">
              <div className="w-full">
                <EmbeddedSignup
                  appId={appId}
                  configId={configId}
                  includeCatalog={includeCatalog}
                  state="whatsapp"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)]/50 py-2 px-4 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>You will be redirected to Facebook to authorize.</span>
              </div>
            </CardBody>

            <CardFooter className="bg-[var(--st-bg-secondary)]/20 border-t pt-6">
              <div className="flex flex-col items-start w-full space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-catalog"
                    checked={includeCatalog}
                    onCheckedChange={(checked) =>
                      setIncludeCatalog(Boolean(checked))
                    }
                    className="data-[state=checked]:bg-[var(--st-text)] data-[state=checked]:text-[var(--st-text-inverted)]"
                  />
                  <Label
                    htmlFor="include-catalog"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Include permissions for Catalog Management
                  </Label>
                </div>
                <p className="text-xs text-[var(--st-text-secondary)] ml-7 text-left">
                  Enable this if you want to sync your product catalog and send product messages via WhatsApp.
                </p>
              </div>
            </CardFooter>
          </Card>
          
          <div className="mt-8 text-center text-sm text-[var(--st-text-secondary)] flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--st-text)]" />
            End-to-end encrypted connection provided by Meta.
          </div>
        </div>
      </div>
    </div>
  );
}
