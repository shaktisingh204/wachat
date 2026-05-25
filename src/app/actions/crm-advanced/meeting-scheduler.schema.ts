import { z } from 'zod';

export const meeting_scheduler_schema = z.object({
  meetingTitle: z.string().min(1, 'meetingTitle is required'),
  attendees: z.string().min(1, 'attendees is required'),
  status: z.enum(['scheduled', 'canceled', 'completed']),
});

export type MeetingSchedulerType = z.infer<typeof meeting_scheduler_schema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};
