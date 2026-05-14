import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquareDashed } from 'lucide-react';

export const metadata = { title: 'Auto-Reply — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <MessageSquareDashed className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Auto-Reply</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Rule builder pairing inbound triggers with automated actions, plus a sandbox to verify which rule fires.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Compose triggers (keyword, regex, time-of-day, label, business-hours, new-contact) and chain them to actions like template sends or flow handoffs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Triggers: keyword match, contains, regex, time-of-day.</li>
            <li>Triggers: contact-label, outside business hours, first message from new contact.</li>
            <li>Actions: send template, forward to flow, set away message, add label.</li>
            <li>Per-rule enable toggle with priority ordering.</li>
            <li>Test sandbox to paste an inbound message and preview which rule fires.</li>
            <li>Audit trail for every rule execution.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
