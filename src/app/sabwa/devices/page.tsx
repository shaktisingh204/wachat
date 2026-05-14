import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone } from 'lucide-react';

export const metadata = { title: 'Linked Devices — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Linked Devices</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage every WhatsApp session linked to this project from one place.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A session table with rename, logout, and delete row actions, and a CTA to connect another number that mirrors the Connect Account flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Table of all sessions for this project.</li>
            <li>Columns for phone, label, status, last seen, platform, and paired-on date.</li>
            <li>Row actions: rename, logout, delete.</li>
            <li>&quot;Connect another number&quot; CTA reusing the Connect Account UX.</li>
            <li>Mobile view renders sessions as stacked cards instead of a table.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
