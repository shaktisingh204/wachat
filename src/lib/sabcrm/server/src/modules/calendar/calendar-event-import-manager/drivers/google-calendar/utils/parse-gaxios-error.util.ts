import { type GaxiosError } from 'gaxios';

import {
  CalendarEventImportDriverException,
  CalendarEventImportDriverExceptionCode,
} from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/exceptions/calendar-event-import-driver.exception';

// PORT-NOTE: MessageNetworkExceptionCode is inlined here as string literals to
// avoid a cross-module import from the messaging module.
const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ERR_NETWORK',
]);

export const parseGaxiosError = (
  error: GaxiosError,
): CalendarEventImportDriverException => {
  const { code } = error;

  if (code && NETWORK_ERROR_CODES.has(code)) {
    return new CalendarEventImportDriverException(
      error.message,
      CalendarEventImportDriverExceptionCode.TEMPORARY_ERROR,
    );
  }

  console.error('[parseGaxiosError]', error);

  return new CalendarEventImportDriverException(
    error.message,
    CalendarEventImportDriverExceptionCode.UNKNOWN_NETWORK_ERROR,
  );
};
