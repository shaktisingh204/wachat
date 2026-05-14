import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode } from 'lucide-react';

export const metadata = { title: 'Connect Account — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <QrCode className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Connect Account</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Link your personal WhatsApp number to SabWa using a refreshing QR code or an 8-character pair code.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Two-mode connection flow with a live status pill that tracks pairing from Waiting through Pairing, Syncing, and Ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>QR mode with a 264x264 code refreshing every 30 seconds and a centered SabNode brand mark.</li>
            <li>Step hints: Open WhatsApp, Settings, Linked Devices, Link a Device.</li>
            <li>Pair-code mode with libphonenumber-js validation for the phone-number input.</li>
            <li>8-character monospace pair code (for example JKLM-NPQR).</li>
            <li>Live status pill: Waiting, Pairing, Syncing, Ready.</li>
            <li>Animated progress indicator during the initial sync.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
