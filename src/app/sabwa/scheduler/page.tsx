import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock } from 'lucide-react';

export const metadata = { title: 'Scheduler — Calendar — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Scheduler — Calendar</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            FullCalendar-style view for your scheduled WhatsApp messages, with drag-to-reschedule and click-to-edit.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Month / week / day calendar surface where every scheduled message becomes a draggable event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Month, week, and day calendar views.</li>
            <li>Each scheduled message renders as a draggable event.</li>
            <li>Drag to reschedule without opening the editor.</li>
            <li>Click an event to edit target, content, and timing.</li>
            <li>Color coding by chat, group, or broadcast target.</li>
            <li>Quick-create from any empty time slot.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
