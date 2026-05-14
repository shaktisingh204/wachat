import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

export const metadata = { title: 'Quick Replies — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Zap className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Quick Replies</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Slash-command shortcuts that expand into saved blurbs — keyboard-first replies in the composer.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Define short slash commands that expand into longer, polished responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Slash-command shortcuts like <code>/thanks</code> that expand on send.</li>
            <li>Each shortcut maps to a saved blurb of text.</li>
            <li>Hotkey support directly inside the composer.</li>
            <li>Inline autocomplete suggestions while typing.</li>
            <li>Searchable list of all your saved quick replies.</li>
            <li>Quickly edit, duplicate, or retire any shortcut.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
