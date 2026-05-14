import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CircleDot } from 'lucide-react';

export const metadata = { title: 'Status / Stories — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <CircleDot className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Status / Stories</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            View friends&apos; statuses and post your own (text, image, or video) with per-status audience control.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            A first-class status feed inside SabWa. Posting is beta because the underlying transport remains brittle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>View friends&apos; statuses — image, video, or text.</li>
            <li>Post text status with selectable background colour.</li>
            <li>Post image or video status from device or SabFiles.</li>
            <li>Per-status views list with timestamps.</li>
            <li>Privacy controls — choose the audience per post.</li>
            <li>Posting marked beta — transport reliability is improving.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
