import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export const metadata = { title: 'Groups — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            All your WhatsApp groups, filtered from chats, with group-specific tooling layered on top.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Chats filtered to <code>type=group</code> with category strip, admin badges, and group-only actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Category strip at top (Family / Work / Communities / Other) with drag-to-categorize.</li>
            <li>&ldquo;Announcement only&rdquo; badge for read-only groups.</li>
            <li>Member count visible per group, plus admin badge when you&apos;re an admin.</li>
            <li>Group invite-link generator (admin only).</li>
            <li>&ldquo;Mute all groups&rdquo; toggle for a quiet inbox.</li>
            <li>Quick jump into the per-group manager from any row.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
