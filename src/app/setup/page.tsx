'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardFooter,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Checkbox,
  Label,
  Progress,
} from '@/components/zoruui';
import { useState } from 'react';

/**
 * ✅ FIX: EmbeddedSignup is a DEFAULT export
 * DO NOT use `{ EmbeddedSignup }`
 */
import EmbeddedSignup from '@/components/zoruui-domain/embedded-signup';

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
        <Card className="max-w-2xl w-full border-zoru-danger/20 shadow-lg">
          <ZoruCardHeader className="bg-destructive/5 border-b border-destructive/10 pb-6">
            <ZoruCardTitle className="flex items-center gap-2 text-zoru-danger text-xl">
              <AlertCircle className="h-6 w-6" />
              Meta Configuration Required
            </ZoruCardTitle>
            <ZoruCardDescription className="text-base mt-2">
              Your Meta Embedded Signup environment variables are missing. Follow these steps to configure them and enable WhatsApp Business Account connections.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-8 pt-8">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoru-ink/10 text-zoru-ink font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-lg">Create a Meta App</h3>
                  <p className="text-zoru-ink-muted mt-1 leading-relaxed">Go to the Meta App Dashboard, create a Business App, and add the WhatsApp product to your app.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoru-ink/10 text-zoru-ink font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-lg">Get your App ID</h3>
                  <p className="text-zoru-ink-muted mt-1 leading-relaxed">Find your App ID at the top of the App Dashboard. Add this as <code className="bg-zoru-surface px-1.5 py-0.5 rounded text-sm font-mono border">NEXT_PUBLIC_META_ONBOARDING_APP_ID</code> in your <code className="bg-zoru-surface px-1.5 py-0.5 rounded text-sm font-mono border">.env</code> file.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zoru-ink/10 text-zoru-ink font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-lg">Create a Configuration ID</h3>
                  <p className="text-zoru-ink-muted mt-1 leading-relaxed">In the WhatsApp product settings, go to "Embedded Signup", create a configuration, and copy the Configuration ID. Add this as <code className="bg-zoru-surface px-1.5 py-0.5 rounded text-sm font-mono border">NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID</code> in your <code className="bg-zoru-surface px-1.5 py-0.5 rounded text-sm font-mono border">.env</code> file.</p>
                </div>
              </div>
            </div>
            
            <Alert variant="default" className="bg-zoru-surface/50 border-zoru-ink/20">
              <AlertCircle className="h-4 w-4 text-primary" />
              <ZoruAlertTitle className="text-primary font-semibold">Restart Required</ZoruAlertTitle>
              <ZoruAlertDescription>
                After updating your <code className="bg-zoru-bg px-1 py-0.5 rounded text-xs border">.env</code> file, remember to restart your Next.js development server to apply the changes.
              </ZoruAlertDescription>
            </Alert>
          </ZoruCardContent>
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
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zoru-surface rounded-full overflow-hidden z-0">
              <div className="h-full bg-zoru-ink w-[15%] transition-all duration-500 ease-in-out"></div>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-zoru-bg px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-ink text-zoru-on-primary font-bold shadow-md ring-4 ring-background">
                1
              </div>
              <span className="text-sm font-semibold mt-3">Connect</span>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-zoru-bg px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface text-zoru-ink-muted font-bold ring-4 ring-background">
                2
              </div>
              <span className="text-sm font-medium mt-3 text-zoru-ink-muted">Configure</span>
            </div>
            
            <div className="flex flex-col items-center relative z-10 bg-zoru-bg px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface text-zoru-ink-muted font-bold ring-4 ring-background">
                3
              </div>
              <span className="text-sm font-medium mt-3 text-zoru-ink-muted">Ready</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold font-headline tracking-tight">
            Connect Your WhatsApp Account
          </h1>
          <p className="text-zoru-ink-muted mt-3 text-lg max-w-2xl mx-auto">
            Use our guided setup to securely connect your WhatsApp Business Account to begin sending and receiving messages.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto">
          <Card className="flex flex-col text-center shadow-lg border-zoru-ink/20 overflow-hidden">
            <div className="h-2 bg-zoru-ink w-full"></div>
            <ZoruCardHeader className="pb-4">
              <ZoruCardTitle className="text-2xl">Guided Setup</ZoruCardTitle>
              <ZoruCardDescription className="text-base">
                We recommend using the secure pop-up to connect your account in a few clicks.
              </ZoruCardDescription>
            </ZoruCardHeader>

            <ZoruCardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6 py-6">
              <div className="w-full">
                <EmbeddedSignup
                  appId={appId}
                  configId={configId}
                  includeCatalog={includeCatalog}
                  state="whatsapp"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-zoru-ink-muted bg-zoru-surface/50 py-2 px-4 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>You will be redirected to Facebook to authorize.</span>
              </div>
            </ZoruCardContent>

            <ZoruCardFooter className="bg-zoru-surface/20 border-t pt-6">
              <div className="flex flex-col items-start w-full space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-catalog"
                    checked={includeCatalog}
                    onCheckedChange={(checked) =>
                      setIncludeCatalog(Boolean(checked))
                    }
                    className="data-[state=checked]:bg-zoru-ink data-[state=checked]:text-zoru-on-primary"
                  />
                  <Label
                    htmlFor="include-catalog"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Include permissions for Catalog Management
                  </Label>
                </div>
                <p className="text-xs text-zoru-ink-muted ml-7 text-left">
                  Enable this if you want to sync your product catalog and send product messages via WhatsApp.
                </p>
              </div>
            </ZoruCardFooter>
          </Card>
          
          <div className="mt-8 text-center text-sm text-zoru-ink-muted flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            End-to-end encrypted connection provided by Meta.
          </div>
        </div>
      </div>
    </div>
  );
}
