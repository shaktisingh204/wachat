import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { SettingsTabs } from '../_components/settings-tabs';

export const metadata = { title: 'Settings — Notifications — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Settings — Notifications</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Control where SabWa pings you when new messages, calls, or system events come in.
          </p>
        </div>
      </div>
      <SettingsTabs />
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Tune desktop, email, push, and sound channels independently — plus mute schedules for quiet hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Desktop notifications for new messages and mentions.</li>
            <li>Email digests and per-event email alerts.</li>
            <li>Mobile push notifications via the SabNode app.</li>
            <li>Custom notification sounds.</li>
            <li>Mute schedules for quiet hours and weekends.</li>
            <li>Per-chat and per-group override toggles.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
