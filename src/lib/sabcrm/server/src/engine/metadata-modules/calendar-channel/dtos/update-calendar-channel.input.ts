import { z } from 'zod';

import {
  CalendarChannelContactAutoCreationPolicy,
  CalendarChannelVisibility,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';

export const UpdateCalendarChannelInputUpdatesSchema = z.object({
  visibility: z.nativeEnum(CalendarChannelVisibility).optional(),
  isContactAutoCreationEnabled: z.boolean().optional(),
  contactAutoCreationPolicy: z.nativeEnum(CalendarChannelContactAutoCreationPolicy).optional(),
  isSyncEnabled: z.boolean().optional(),
});

export type UpdateCalendarChannelInputUpdates = z.infer<typeof UpdateCalendarChannelInputUpdatesSchema>;

export const UpdateCalendarChannelInputSchema = z.object({
  id: z.string().uuid(),
  update: UpdateCalendarChannelInputUpdatesSchema,
});

export type UpdateCalendarChannelInput = z.infer<typeof UpdateCalendarChannelInputSchema>;
