import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils';

import { CustomException } from '@/lib/sabcrm/server/src/utils/custom-exception';

export enum CalendarChannelExceptionCode {
  CALENDAR_CHANNEL_NOT_FOUND = 'CALENDAR_CHANNEL_NOT_FOUND',
  INVALID_CALENDAR_CHANNEL_INPUT = 'INVALID_CALENDAR_CHANNEL_INPUT',
  CALENDAR_CHANNEL_OWNERSHIP_VIOLATION = 'CALENDAR_CHANNEL_OWNERSHIP_VIOLATION',
}

// PORT-NOTE: @lingui/core msg` ` replaced with plain strings for Next.js compatibility.
const getCalendarChannelExceptionUserFriendlyMessage = (
  code: CalendarChannelExceptionCode,
): string => {
  switch (code) {
    case CalendarChannelExceptionCode.CALENDAR_CHANNEL_NOT_FOUND:
      return 'Calendar channel not found.';
    case CalendarChannelExceptionCode.INVALID_CALENDAR_CHANNEL_INPUT:
      return 'Invalid calendar channel input.';
    case CalendarChannelExceptionCode.CALENDAR_CHANNEL_OWNERSHIP_VIOLATION:
      return 'You do not have access to this calendar channel.';
    default:
      assertUnreachable(code);
  }
};

export class CalendarChannelException extends CustomException<CalendarChannelExceptionCode> {
  constructor(
    message: string,
    code: CalendarChannelExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ??
        getCalendarChannelExceptionUserFriendlyMessage(code),
    });
  }
}
