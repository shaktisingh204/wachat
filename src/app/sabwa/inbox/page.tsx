import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';

export const metadata = { title: 'Inbox — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The crown jewel: a WhatsApp-Web-style three-pane inbox for every chat, group, and broadcast.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Three-pane layout (chat list, conversation, contact panel) with a full-featured composer and rich conversation tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Three-pane layout with search and filters for All, Unread, Groups, Personal.</li>
            <li>Composer with markdown shortcuts, emoji picker, SabFile attachments, and voice notes.</li>
            <li>Reply or quote, mention picker for groups, schedule-send, and disappearing-message toggle.</li>
            <li>Reactions, star, forward, edit (15-min window), and delete for me or everyone.</li>
            <li>Media gallery viewer, voice waveform with playback speed, doc and location previews, polls.</li>
            <li>Mobile single-pane navigation: list to conversation to contact panel.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
