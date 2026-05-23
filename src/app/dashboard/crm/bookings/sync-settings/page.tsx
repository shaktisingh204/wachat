import * as React from 'react';
import Link from 'next/link';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

export default function SyncSettingsPage() {
  return (
    <EntityListShell
      title="Calendar Sync"
      subtitle="Integrate Google Calendar or Outlook for two-way sync."
      primaryAction={
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/bookings">Back to Bookings</Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Google Calendar</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <p className="text-[13px] text-zoru-ink-muted">
              Sync your Bookings with Google Calendar. Appointments created here will show up in Google Calendar, and busy slots from Google Calendar will block out availability here.
            </p>
            <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-center text-[12px] text-zoru-ink-muted">
              Not connected
            </div>
            <Button className="w-full">Connect Google Calendar</Button>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Outlook Calendar</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <p className="text-[13px] text-zoru-ink-muted">
              Two-way sync for Microsoft Outlook and Office 365 calendars. Ensure your schedule is always up to date across all your devices.
            </p>
            <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-center text-[12px] text-zoru-ink-muted">
              Not connected
            </div>
            <Button className="w-full">Connect Outlook</Button>
          </ZoruCardContent>
        </Card>
      </div>
    </EntityListShell>
  );
}
