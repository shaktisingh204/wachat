import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhoneCall } from 'lucide-react';

export const metadata = { title: 'Calls — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <PhoneCall className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only call log surfaced from Baileys events, since the engine cannot reliably initiate calls.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A unified call history view with filters and per-call detail so you can audit incoming, outgoing, and video activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Chronological call log fed by Baileys call events.</li>
            <li>Filter by missed, incoming, outgoing, or video.</li>
            <li>Per-call duration in human-readable format.</li>
            <li>Participant list with avatar and JID.</li>
            <li>Quick jump to the participant&apos;s chat thread.</li>
            <li>Read-only by design — no outbound dialing from the module.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
