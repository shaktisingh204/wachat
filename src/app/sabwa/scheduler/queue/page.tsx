import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListChecks } from 'lucide-react';

export const metadata = { title: 'Scheduled Queue — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <ListChecks className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Scheduled Queue</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Table view of every pending, sent, and failed scheduled message — with bulk reschedule and cancel.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A power-user table to triage the scheduling pipeline at scale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Unified table of pending, sent, and failed scheduled messages.</li>
            <li>Filter by chat, group, or broadcast target.</li>
            <li>Bulk reschedule selected rows in one action.</li>
            <li>Bulk cancel pending sends safely.</li>
            <li>Drill into recurring parents and their child instances.</li>
            <li>Inspect failure reasons for retry decisions.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
