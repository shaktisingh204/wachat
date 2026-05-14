import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCog } from 'lucide-react';
import { SettingsTabs } from './_components/settings-tabs';

export const metadata = { title: 'Settings — Profile — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <UserCog className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Settings — Profile</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the public face of your connected WhatsApp account — name, about, and profile picture.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Edit profile fields locally and choose whether to sync from WhatsApp or push your SabNode values up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Edit push name shown to recipients.</li>
            <li>Edit the &quot;about&quot; / status line.</li>
            <li>Upload or change profile picture.</li>
            <li>Sync profile fields from WhatsApp into SabNode.</li>
            <li>Push SabNode profile values up to WhatsApp.</li>
            <li>Danger zone: disconnect, wipe data, or delete the account.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
