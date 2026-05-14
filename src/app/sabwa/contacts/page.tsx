import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookUser } from 'lucide-react';

export const metadata = { title: 'Contacts — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <BookUser className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Unified contact book for synced, manual, and imported numbers — with tags, mutual groups, and history.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            DataTable plus single-contact drawer that surfaces everything you know about a number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>DataTable columns for avatar, name, number, last interaction, and tags.</li>
            <li>Source filter: synced, manual, or imported.</li>
            <li>Bulk actions: tag, label, message, export, and block.</li>
            <li>Contact drawer with mutual groups overview.</li>
            <li>Full message and scheduled-message history per contact.</li>
            <li>Editable custom fields for CRM-style enrichment.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
