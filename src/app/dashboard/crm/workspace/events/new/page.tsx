'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { Calendar, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveEvent } from '@/app/actions/worksuite/knowledge.actions';

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
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
      <ClayCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="event_name" className="text-clay-ink">Event name *</Label>
            <Input id="event_name" name="event_name" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description" className="text-clay-ink">Description</Label>
            <Textarea id="description" name="description" rows={4} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="where" className="text-clay-ink">Where</Label>
            <Input id="where" name="where" className="mt-1.5 h-10" />
          </div>

          <div>
            <Label htmlFor="label_color" className="text-clay-ink">Label color</Label>
            <Input
              id="label_color"
              name="label_color"
              type="color"
              defaultValue="#e11d48"
              className="mt-1.5 h-10 w-full"
            />
          </div>

          <div>
            <Label htmlFor="start_date_time" className="text-clay-ink">Start *</Label>
            <Input
              id="start_date_time"
              name="start_date_time"
              type="datetime-local"
              required
              className="mt-1.5 h-10"
            />
          </div>
          <div>
            <Label htmlFor="end_date_time" className="text-clay-ink">End *</Label>
            <Input
              id="end_date_time"
              name="end_date_time"
              type="datetime-local"
              required
              className="mt-1.5 h-10"
            />
          </div>

          <div>
            <Label htmlFor="repeat" className="text-clay-ink">Repeat</Label>
            <Select name="repeat" defaultValue="false">
              <SelectTrigger id="repeat" className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repeat_type" className="text-clay-ink">Repeat type</Label>
            <Select name="repeat_type" defaultValue="week">
              <SelectTrigger id="repeat_type" className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repeat_every" className="text-clay-ink">Repeat every</Label>
            <Input id="repeat_every" name="repeat_every" type="number" min={1} defaultValue={1} className="mt-1.5 h-10" />
          </div>
          <div>
            <Label htmlFor="repeat_cycles" className="text-clay-ink">Cycles</Label>
            <Input id="repeat_cycles" name="repeat_cycles" type="number" min={1} defaultValue={1} className="mt-1.5 h-10" />
          </div>

          <div>
            <Label htmlFor="send_reminder" className="text-clay-ink">Send reminder</Label>
            <Select name="send_reminder" defaultValue="false">
              <SelectTrigger id="send_reminder" className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="remind_time" className="text-clay-ink">Remind time</Label>
            <Input id="remind_time" name="remind_time" type="number" min={0} className="mt-1.5 h-10" />
          </div>
          <div>
            <Label htmlFor="remind_type" className="text-clay-ink">Remind type</Label>
            <Select name="remind_type" defaultValue="hour">
              <SelectTrigger id="remind_type" className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Hour</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="google_calendar" className="text-clay-ink">Google Calendar</Label>
            <Select name="google_calendar" defaultValue="false">
              <SelectTrigger id="google_calendar" className="mt-1.5 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="online_link" className="text-clay-ink">Online link</Label>
            <Input id="online_link" name="online_link" type="url" className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <ClayButton variant="pill" type="button" onClick={() => router.back()}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              type="submit"
              disabled={isPending}
              leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            >
              Save Event
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
