import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText } from 'lucide-react';

export const metadata = { title: 'Audit Log — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <ScrollText className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Append-only record of every action in SabWa — mandatory for compliance and incident review.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Forensic timeline of who did what, when, and from where — searchable, filterable, and exportable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Append-only log entries — no edits, no deletes.</li>
            <li>Captures actor, action, target, timestamp, and IP for every event.</li>
            <li>Filter by actor, action type, or target entity.</li>
            <li>Full-text search across the log.</li>
            <li>Export to CSV or JSON for offline review.</li>
            <li>Mandatory for compliance and team accountability.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
