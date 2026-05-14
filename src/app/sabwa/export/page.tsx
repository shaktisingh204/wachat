import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

export const metadata = { title: 'Export / Backup — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Download className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Export / Backup</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Run background exports of selected chats in your preferred format and receive a signed download link.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Multi-step wizard to pick chats and format, queue a background job, and notify by email with an R2 link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Pick one or many chats to include in the export.</li>
            <li>Choose format: JSON, CSV, WhatsApp .txt, or PDF.</li>
            <li>Include-media toggle to bundle attachments.</li>
            <li>Run as a background job with progress feedback.</li>
            <li>Email notification with an R2-hosted download link.</li>
            <li>History of past exports with re-download.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
