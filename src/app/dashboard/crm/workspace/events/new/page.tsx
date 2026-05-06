'use client';
import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Calendar, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

import { saveEvent } from '@/app/actions/worksuite/knowledge.actions';

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveEvent, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/workspace/events');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader title="New Event" subtitle="Schedule an event." icon={Calendar} />
      <ZoruCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="event_name" className="text-foreground">Event name *</ZoruLabel>
            <ZoruInput id="event_name" name="event_name" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <ZoruLabel htmlFor="description" className="text-foreground">Description</ZoruLabel>
            <ZoruTextarea id="description" name="description" rows={4} className="mt-1.5" />
          </div>

          <div>
            <ZoruLabel htmlFor="where" className="text-foreground">Where</ZoruLabel>
            <ZoruInput id="where" name="where" className="mt-1.5 h-10" />
          </div>

          <div>
            <ZoruLabel htmlFor="label_color" className="text-foreground">Label color</ZoruLabel>
            <ZoruInput
              id="label_color"
              name="label_color"
              type="color"
              defaultValue="#e11d48"
              className="mt-1.5 h-10 w-full"
            />
          </div>

          <div>
            <ZoruLabel htmlFor="start_date_time" className="text-foreground">Start *</ZoruLabel>
            <ZoruInput
              id="start_date_time"
              name="start_date_time"
              type="datetime-local"
              required
              className="mt-1.5 h-10"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="end_date_time" className="text-foreground">End *</ZoruLabel>
            <ZoruInput
              id="end_date_time"
              name="end_date_time"
              type="datetime-local"
              required
              className="mt-1.5 h-10"
            />
          </div>

          <div>
            <ZoruLabel htmlFor="repeat" className="text-foreground">Repeat</ZoruLabel>
            <ZoruSelect name="repeat" defaultValue="false">
              <ZoruSelectTrigger id="repeat" className="mt-1.5 h-10"><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="repeat_type" className="text-foreground">Repeat type</ZoruLabel>
            <ZoruSelect name="repeat_type" defaultValue="week">
              <ZoruSelectTrigger id="repeat_type" className="mt-1.5 h-10"><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="day">Day</ZoruSelectItem>
                <ZoruSelectItem value="week">Week</ZoruSelectItem>
                <ZoruSelectItem value="month">Month</ZoruSelectItem>
                <ZoruSelectItem value="year">Year</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="repeat_every" className="text-foreground">Repeat every</ZoruLabel>
            <ZoruInput id="repeat_every" name="repeat_every" type="number" min={1} defaultValue={1} className="mt-1.5 h-10" />
          </div>
          <div>
            <ZoruLabel htmlFor="repeat_cycles" className="text-foreground">Cycles</ZoruLabel>
            <ZoruInput id="repeat_cycles" name="repeat_cycles" type="number" min={1} defaultValue={1} className="mt-1.5 h-10" />
          </div>

          <div>
            <ZoruLabel htmlFor="send_reminder" className="text-foreground">Send reminder</ZoruLabel>
            <ZoruSelect name="send_reminder" defaultValue="false">
              <ZoruSelectTrigger id="send_reminder" className="mt-1.5 h-10"><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="remind_time" className="text-foreground">Remind time</ZoruLabel>
            <ZoruInput id="remind_time" name="remind_time" type="number" min={0} className="mt-1.5 h-10" />
          </div>
          <div>
            <ZoruLabel htmlFor="remind_type" className="text-foreground">Remind type</ZoruLabel>
            <ZoruSelect name="remind_type" defaultValue="hour">
              <ZoruSelectTrigger id="remind_type" className="mt-1.5 h-10"><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="hour">Hour</ZoruSelectItem>
                <ZoruSelectItem value="day">Day</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div>
            <ZoruLabel htmlFor="google_calendar" className="text-foreground">Google Calendar</ZoruLabel>
            <ZoruSelect name="google_calendar" defaultValue="false">
              <ZoruSelectTrigger id="google_calendar" className="mt-1.5 h-10"><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="online_link" className="text-foreground">Online link</ZoruLabel>
            <ZoruInput id="online_link" name="online_link" type="url" className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <ZoruButton variant="outline" type="button" onClick={() => router.back()}>
              Cancel
            </ZoruButton>
            <ZoruButton
             
              type="submit"
              disabled={isPending}
             
            >
              Save Event
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
