import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquareText } from 'lucide-react';

export const metadata = { title: 'Chats — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <MessageSquareText className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The inbox filtered down to individual chats, with a bulk-actions toolbar for power workflows.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Same three-pane inbox experience, scoped to one-on-one conversations and equipped with multi-select bulk actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Inbox filtered to type=individual chats only.</li>
            <li>Multi-select chats from the list pane.</li>
            <li>Bulk mark as read.</li>
            <li>Bulk archive and mute.</li>
            <li>Bulk label assignment.</li>
            <li>Bulk export of selected conversations.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
