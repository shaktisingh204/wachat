import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone } from 'lucide-react';
import { SettingsTabs } from '../_components/settings-tabs';

export const metadata = { title: 'Settings — Devices — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Settings — Devices</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect every linked device for this number and unlink anything that looks off.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A live view of all WhatsApp-linked devices with health, platform, and last-seen data — plus quick unlink.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>List of every linked device for your account.</li>
            <li>Platform, app version, and last activity per device.</li>
            <li>Connection status indicator (online, idle, expecting reconnect).</li>
            <li>One-click unlink for any device.</li>
            <li>Direct link to the full Linked Devices page.</li>
            <li>Rotate the session encryption key.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
