
import { EmbeddedSignup } from '@/components/wabasimplify/embedded-signup';
import { Card, CardContent } from '@/components/ui/card';
import type { Metadata } from 'next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Setup | Wachat',
};

export default function SetupPage() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.META_CONFIG_ID;

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
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl font-bold font-headline">Connect Your WhatsApp Account</h1>
        <p className="text-muted-foreground mt-2">
          To get started, click the button below to launch the secure setup process. This will allow Wachat to manage your campaigns, templates, and messages on your behalf.
        </p>
      </div>
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 flex flex-col items-center text-center gap-6">
            <h2 className="text-xl font-semibold">Ready to connect?</h2>
            <EmbeddedSignup appId={appId} configId={configId} />
            <p className="text-xs text-muted-foreground">
                You will be redirected to Facebook to authorize the connection. Wachat will not see your Facebook password.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
