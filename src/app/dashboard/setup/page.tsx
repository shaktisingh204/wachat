
'use client';

import { useState } from 'react';
import { EmbeddedSignup } from '@/components/wabasimplify/embedded-signup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Key, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;
  const [includeCatalog, setIncludeCatalog] = useState(true);

  if (!appId || !configId) {
    return (
        <Alert variant="destructive" className="max-w-lg mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Error</AlertTitle>
            <AlertDescription>
                <p>The `NEXT_PUBLIC_META_ONBOARDING_APP_ID` and `NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID` must be set in your .env file.</p>
                <p className="mt-2 text-xs">Please contact the system administrator to configure the integration correctly.</p>
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8 items-center justify-center h-full">
      <Card className="text-center max-w-2xl">
        <CardHeader>
            <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                <WhatsAppIcon className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl">Connect Your WhatsApp Account</CardTitle>
            <CardDescription>
                Use our guided setup to securely connect your WhatsApp Business Account. This will allow you to send messages, create templates, and manage your communications.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Dialog>
                <DialogTrigger asChild>
                    <Button size="lg">Connect WhatsApp Account</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                     <DialogHeader>
                        <DialogTitle>Guided Setup</DialogTitle>
                        <DialogDescription>
                            You will be redirected to Facebook to authorize the connection.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <EmbeddedSignup appId={appId} configId={configId} includeCatalog={includeCatalog} state="whatsapp" />
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="include-catalog" checked={includeCatalog} onCheckedChange={(checked) => setIncludeCatalog(!!checked)} />
                            <Label htmlFor="include-catalog" className="text-sm font-normal">
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
