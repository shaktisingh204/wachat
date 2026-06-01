'use server';

// PORT-NOTE: NestJS GraphQL resolver -> Next.js server actions.
// Auth guards (WorkspaceAuthGuard, NoPermissionGuard) and decorators
// (@AuthWorkspace, @AuthUserWorkspaceId) must be enforced by the calling layer.
// The interceptor is applied via withCalendarChannelExceptionHandling().

import type { CalendarChannelDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';
import type { UpdateCalendarChannelInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/update-calendar-channel.input';
import { withCalendarChannelExceptionHandling } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/interceptors/calendar-channel-graphql-api-exception.interceptor';
import { calendarChannelMetadataService } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/calendar-channel-metadata.service';

// --- Query: myCalendarChannels ---
export async function myCalendarChannels({
  workspaceId,
  userWorkspaceId,
  connectedAccountId,
}: {
  workspaceId: string;
  userWorkspaceId: string;
  connectedAccountId?: string;
}): Promise<CalendarChannelDTO[]> {
  return withCalendarChannelExceptionHandling(async () => {
    if (connectedAccountId) {
      return calendarChannelMetadataService.findByConnectedAccountIdForUser({
        connectedAccountId,
        userWorkspaceId,
        workspaceId,
      });
    }

    return calendarChannelMetadataService.findByUserWorkspaceId({
      userWorkspaceId,
      workspaceId,
    });
  });
}

// --- Mutation: updateCalendarChannel ---
export async function updateCalendarChannel({
  input,
  workspaceId,
  userWorkspaceId,
}: {
  input: UpdateCalendarChannelInput;
  workspaceId: string;
  userWorkspaceId: string;
}): Promise<CalendarChannelDTO> {
  return withCalendarChannelExceptionHandling(async () => {
    await calendarChannelMetadataService.verifyOwnership({
      id: input.id,
      userWorkspaceId,
      workspaceId,
    });

    return calendarChannelMetadataService.update({
      id: input.id,
      workspaceId,
      data: input.update,
    });
  });
}
