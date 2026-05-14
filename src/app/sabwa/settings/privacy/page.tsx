import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { SettingsTabs } from '../_components/settings-tabs';

export const metadata = { title: 'Settings — Privacy & Security — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Settings — Privacy &amp; Security</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Lock down who can see what, who can reach you, and how your session is encrypted.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Mirror of WhatsApp&apos;s privacy controls plus extra SabNode-side hardening for the session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Enable and manage two-factor authentication.</li>
            <li>Manage your blocked-contacts list.</li>
            <li>Configure read-receipt visibility.</li>
            <li>Configure last-seen visibility.</li>
            <li>Control who can add you to groups.</li>
            <li>Rotate the session encryption key on demand.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
