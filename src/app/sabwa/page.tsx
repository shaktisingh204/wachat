import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard } from 'lucide-react';

export const metadata = { title: 'Overview — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            At-a-glance dashboard for your connected WhatsApp account: presence, activity, queue health, and ban-risk.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Hero showing the connected number, presence, and profile picture, paired with summary metric cards and a recent activity feed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Hero with connected number, presence, and profile picture.</li>
            <li>Today&apos;s messages in / out at a glance.</li>
            <li>Scheduled queue size and active groups count.</li>
            <li>Response-time median across chats.</li>
            <li>Ban-risk gauge computed from velocity and report signals.</li>
            <li>Recent activity feed.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
