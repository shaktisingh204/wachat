
'use client';

import { useState } from 'react';
import { EmbeddedSignup } from '@/components/wabasimplify/embedded-signup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Key } from 'lucide-react';
import { CreateProjectDialog } from '@/components/wabasimplify/project-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.META_CONFIG_ID;
  const [includeCatalog, setIncludeCatalog] = useState(true);

  if (!appId || !configId) {
    return (
        <Alert variant="destructive" className="max-w-lg mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Error</AlertTitle>
            <AlertDescription>
                <p>NEXT_PUBLIC_META_APP_ID and META_CONFIG_ID must be set in your .env file.</p>
                <p className="mt-2 text-xs">Please contact the system administrator to configure the integration correctly.</p>
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8 items-center">
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl font-bold font-headline">Connect Your WhatsApp Account</h1>
        <p className="text-muted-foreground mt-2">
          Choose your preferred method to connect your WhatsApp Business Account. We recommend the guided setup for most users.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="flex flex-col text-center card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>Guided Setup (Recommended)</CardTitle>
                <CardDescription>Use the secure pop-up to connect your account in a few clicks.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6">
                <EmbeddedSignup appId={appId} configId={configId} includeCatalog={includeCatalog} />
                <p className="text-xs text-muted-foreground">
                    You will be redirected to Facebook to authorize the connection.
                </p>
            </CardContent>
            <CardFooter>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="include-catalog" checked={includeCatalog} onCheckedChange={(checked) => setIncludeCatalog(!!checked)} />
                    <Label htmlFor="include-catalog" className="text-sm font-normal">
                        Include permissions for Catalog Management
                    </Label>
                </div>
            </CardFooter>
        </Card>
        <CreateProjectDialog />
      </div>
    </div>
  );
}
