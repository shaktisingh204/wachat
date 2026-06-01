import { z } from 'zod';

import {
  CalendarChannelContactAutoCreationPolicy,
  CalendarChannelSyncStage,
  CalendarChannelVisibility,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';

export const CreateCalendarChannelInputSchema = z.object({
  id: z.string().uuid().optional(),
  handle: z.string().min(1),
  visibility: z.nativeEnum(CalendarChannelVisibility),
  syncStage: z.nativeEnum(CalendarChannelSyncStage),
  connectedAccountId: z.string().uuid(),
  isContactAutoCreationEnabled: z.boolean(),
  contactAutoCreationPolicy: z.nativeEnum(CalendarChannelContactAutoCreationPolicy),
  isSyncEnabled: z.boolean(),
});

export type CreateCalendarChannelInput = z.infer<typeof CreateCalendarChannelInputSchema>;
