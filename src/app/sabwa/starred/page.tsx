import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export const metadata = { title: 'Starred Messages — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Star className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Starred Messages</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A cross-chat bookmark view for every message you have starred, grouped by conversation.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Surface starred messages from every chat in one place with quick navigation back to the source thread.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Single feed of every starred message across chats and groups.</li>
            <li>Grouped by chat with collapsible sections.</li>
            <li>Jump-to-message link that opens the thread at the correct anchor.</li>
            <li>Preview with sender, timestamp, and media thumbnail.</li>
            <li>Unstar inline without leaving the page.</li>
            <li>Search within starred messages by text or sender.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
