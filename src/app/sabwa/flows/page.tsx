import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow } from 'lucide-react';

export const metadata = { title: 'Chatbot Flows — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Workflow className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Chatbot Flows</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Embed SabFlow&apos;s builder scoped to SabWa triggers and actions for visual conversational automation.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Drag-and-drop flow design with WhatsApp-native triggers and actions, branching by user input, and webhook fan-out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Triggers: message_received, keyword_match, new_contact, group_added.</li>
            <li>Actions: send_message, send_media, add_label.</li>
            <li>Actions: call_webhook, pause, branch_by_input.</li>
            <li>Reuses the SabFlow visual builder inline.</li>
            <li>Per-flow enable toggle and version history.</li>
            <li>Test runner to step through a flow with a mock inbound.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
