"use client";

import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import { FacebookPost } from '@/lib/definitions';
import { handleReschedulePost } from '@/app/actions/facebook.actions';
import { useToast } from '@/components/sabcrm/20ui/compat';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar as any);

interface ScheduledCalendarProps {
  posts: FacebookPost[];
  projectId: string;
  onActionComplete: () => void;
}

export function ScheduledCalendar({ posts, projectId, onActionComplete }: ScheduledCalendarProps) {
  const { toast } = useToast();

  const events = useMemo(() => {
    return posts.map(post => {
      const scheduledTime = post.scheduled_publish_time ? new Date(post.scheduled_publish_time * 1000) : new Date();
      return {
        id: post.id,
        title: post.message || 'Scheduled Media Post',
        start: scheduledTime,
        end: new Date(scheduledTime.getTime() + 30 * 60000), // +30 minutes for visualization
        resource: post,
      };
    });
  }, [posts]);

  const onEventDrop: withDragAndDropProps['onEventDrop'] = useCallback(
    async ({ event, start, end }) => {
      const postId = (event as any).id;
      const newScheduledTime = Math.floor(new Date(start as Date).getTime() / 1000);

      try {
        const res = await handleReschedulePost(projectId, postId, newScheduledTime);
        if (res.success) {
          toast({
            title: 'Post rescheduled',
            description: 'The post has been successfully rescheduled.',
          });
          onActionComplete();
        } else {
          toast({
            title: 'Error',
            description: res.error || 'Failed to reschedule post.',
            variant: 'destructive',
          });
        }
      } catch (err: any) {
        toast({
          title: 'Error',
          description: err.message || 'An error occurred.',
          variant: 'destructive',
        });
      }
    },
    [projectId, onActionComplete, toast]
  );

  return (
    <div className="h-[600px] w-full bg-[var(--st-bg)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] overflow-hidden p-4">
      <DnDCalendar
        localizer={localizer}
        events={events}
        onEventDrop={onEventDrop}
        resizable={false}
        defaultView="month"
        style={{ height: '100%' }}
      />
    </div>
  );
}
