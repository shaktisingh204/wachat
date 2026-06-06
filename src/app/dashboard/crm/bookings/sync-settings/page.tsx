import * as React from 'react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle, CardDescription, Button, Badge } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Calendar, Mail, ArrowLeft, RefreshCw, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SyncSettingsPage() {
  return (
    <EntityListShell
      title="Calendar Sync"
      subtitle="Integrate Google Calendar or Outlook for two-way synchronization."
      primaryAction={
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Calendar Sync */}
        <Card className="flex flex-col transition-all hover:shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center text-base font-semibold">
                <Calendar className="mr-2 h-5 w-5 text-[var(--st-text)]" />
                Google Calendar
              </CardTitle>
              <CardDescription>
                Sync your Bookings with Google Workspace.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <XCircle className="mr-1 h-3 w-3" /> Not Connected
            </Badge>
          </CardHeader>
          <CardBody className="flex flex-1 flex-col justify-between space-y-6 pt-4">
            <p className="text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
              Appointments created here will automatically appear in your Google Calendar.
              Busy slots from your Google Calendar will also block out your availability
              to prevent double booking.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-3 text-sm">
                <span className="text-[var(--st-text-secondary)]">Sync Status</span>
                <span className="font-medium text-[var(--st-text)]">Inactive</span>
              </div>
              <Button className="w-full" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Connect Google Calendar
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Outlook Calendar Sync */}
        <Card className="flex flex-col transition-all hover:shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center text-base font-semibold">
                <Mail className="mr-2 h-5 w-5 text-[var(--st-text)]" />
                Outlook Calendar
              </CardTitle>
              <CardDescription>
                Sync your Bookings with Microsoft 365.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
              <XCircle className="mr-1 h-3 w-3" /> Not Connected
            </Badge>
          </CardHeader>
          <CardBody className="flex flex-1 flex-col justify-between space-y-6 pt-4">
            <p className="text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
              Enable two-way sync for Microsoft Outlook and Office 365 calendars. Ensure
              your schedule is always up to date across all your devices and client meetings.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-3 text-sm">
                <span className="text-[var(--st-text-secondary)]">Sync Status</span>
                <span className="font-medium text-[var(--st-text)]">Inactive</span>
              </div>
              <Button className="w-full" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Connect Outlook Calendar
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </EntityListShell>
  );
}
