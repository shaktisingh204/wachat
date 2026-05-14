import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart } from 'lucide-react';

export const metadata = { title: 'Analytics — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <LineChart className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Recharts dashboards that tell the story of your messaging volume, responsiveness, and anti-ban posture.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A suite of charts covering throughput, responsiveness, group activity, scheduling reliability, and AI spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Messages in and out by day as a line chart.</li>
            <li>Response-time histogram across all chats.</li>
            <li>Top 10 contacts by message volume.</li>
            <li>Group activity heatmap by hour and day.</li>
            <li>Hourly send pattern to help tune anti-ban velocity.</li>
            <li>Scheduled hit rate and AI credits consumed.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
