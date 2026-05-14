import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';

export const metadata = { title: 'Broadcasts — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Send className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Broadcasts</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            WhatsApp&apos;s native broadcast lists &mdash; recipients receive your message as a 1:1, with no visibility between them.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Manage broadcast lists, compose a one-shot blast, and review past sends from a single screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Create, rename, and delete broadcast lists (CRUD).</li>
            <li>Add or remove recipients from any list at any time.</li>
            <li>Send composer with text, media, and variable preview.</li>
            <li>Each recipient sees a 1:1 thread &mdash; no cross-recipient reply visibility.</li>
            <li>History of past broadcasts with per-recipient delivery state.</li>
            <li>Re-send to a saved list with one click.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
