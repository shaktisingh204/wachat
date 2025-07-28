
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Key } from 'lucide-react';
import { InstagramEmbeddedSignup } from '@/components/wabasimplify/instagram-embedded-signup';
import { ManualInstagramSetupDialog } from '@/components/wabasimplify/manual-instagram-setup-dialog';

export default function InstagramSetupPage() {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

  if (!appId) {
    return (
        <Alert variant="destructive" className="max-w-lg mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuration Error</AlertTitle>
            <AlertDescription>
                <p>NEXT_PUBLIC_FACEBOOK_APP_ID must be set in your .env file.</p>
                <p className="mt-2 text-xs">Please contact the system administrator to configure the integration correctly.</p>
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8 items-center">
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl font-bold font-headline">Connect Your Instagram Account</h1>
        <p className="text-muted-foreground mt-2">
          Choose your preferred method to connect your Instagram Business Account. We recommend the guided setup for most users.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="flex flex-col text-center card-gradient card-gradient-purple">
            <CardHeader>
                <CardTitle>Guided Setup (Recommended)</CardTitle>
                <CardDescription>Use the secure pop-up to connect your account in a few clicks.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center text-center gap-6">
                <InstagramEmbeddedSignup appId={appId} />
                <p className="text-xs text-muted-foreground">
                    You will be redirected to Facebook to authorize the connection.
                </p>
            </CardContent>
        </Card>
        <ManualInstagramSetupDialog />
      </div>
    </div>
  );
}
