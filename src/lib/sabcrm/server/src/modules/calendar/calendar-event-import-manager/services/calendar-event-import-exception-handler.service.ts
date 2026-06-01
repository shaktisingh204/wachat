import 'server-only';

// PORT-NOTE: NestJS @Injectable and DI removed — plain exported functions.
// PORT-NOTE: ExceptionHandlerService replaced with console.error + optional captureExceptions callback.
// PORT-NOTE: WorkspaceScopedRepository replaced with Mongo collection accessor.
// PORT-NOTE: TwentyORMException / TwentyORMExceptionCode inlined as a structural type.

import { getCalendarChannelCollection } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import {
  ConnectedAccountRefreshAccessTokenException,
  ConnectedAccountRefreshAccessTokenExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/connected-account/exceptions/connected-account-refresh-tokens.exception';
import { CALENDAR_THROTTLE_MAX_ATTEMPTS } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/constants/calendar-throttle-max-attempts';
import {
  type CalendarEventImportDriverException,
  CalendarEventImportDriverExceptionCode,
} from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/exceptions/calendar-event-import-driver.exception';
import {
  CalendarEventImportException,
  CalendarEventImportExceptionCode,
} from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/exceptions/calendar-event-import.exception';

export enum CalendarEventImportSyncStep {
  CALENDAR_EVENT_LIST_FETCH = 'CALENDAR_EVENT_LIST_FETCH',
  CALENDAR_EVENTS_IMPORT = 'CALENDAR_EVENTS_IMPORT',
}

// Structural type matching TwentyORMException without importing it.
type TwentyORMException = {
  code: string;
  message: string;
};

const TWENTY_ORM_QUERY_READ_TIMEOUT = 'QUERY_READ_TIMEOUT';

type CalendarChannelSyncStatusService = {
  resetAndMarkAsCalendarEventListFetchPending: (ids: string[], workspaceId: string) => Promise<void>;
  markAsCalendarEventListFetchPending: (ids: string[], workspaceId: string, withThrottle?: boolean) => Promise<void>;
  markAsCalendarEventsImportPending: (ids: string[], workspaceId: string, withThrottle?: boolean) => Promise<void>;
  markAsFailedUnknownAndFlushCalendarEventsToImport: (ids: string[], workspaceId: string) => Promise<void>;
  markAsFailedInsufficientPermissionsAndFlushCalendarEventsToImport: (ids: string[], workspaceId: string) => Promise<void>;
};

type ExceptionCapture = {
  captureExceptions?: (
    exceptions: Error[],
    context: { additionalData?: Record<string, unknown>; workspace?: { id: string } },
  ) => void;
};

export async function handleCalendarDriverException(
  exception:
    | CalendarEventImportDriverException
    | TwentyORMException
    | ConnectedAccountRefreshAccessTokenException,
  syncStep: CalendarEventImportSyncStep,
  calendarChannel: { id: string; throttleFailureCount: number },
  workspaceId: string,
  calendarChannelSyncStatusService: CalendarChannelSyncStatusService,
  { captureExceptions }: ExceptionCapture = {},
): Promise<void> {
  const code = (exception as { code: string }).code;

  switch (code) {
    case CalendarEventImportDriverExceptionCode.NOT_FOUND:
      await handleNotFoundException(syncStep, calendarChannel, workspaceId, calendarChannelSyncStatusService);
      break;

    case TWENTY_ORM_QUERY_READ_TIMEOUT:
    case CalendarEventImportDriverExceptionCode.TEMPORARY_ERROR:
    case ConnectedAccountRefreshAccessTokenExceptionCode.TEMPORARY_NETWORK_ERROR:
      await handleTemporaryException(syncStep, calendarChannel, workspaceId, calendarChannelSyncStatusService, { captureExceptions });
      break;

    case CalendarEventImportDriverExceptionCode.INSUFFICIENT_PERMISSIONS:
    case ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND:
    case ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN:
      await handleInsufficientPermissionsException(calendarChannel, workspaceId, calendarChannelSyncStatusService);
      break;

    case CalendarEventImportDriverExceptionCode.SYNC_CURSOR_ERROR:
      await handleSyncCursorErrorException(calendarChannel, workspaceId, calendarChannelSyncStatusService);
      break;

    case CalendarEventImportDriverExceptionCode.CHANNEL_MISCONFIGURED:
    case CalendarEventImportDriverExceptionCode.UNKNOWN:
    case CalendarEventImportDriverExceptionCode.UNKNOWN_NETWORK_ERROR:
    case ConnectedAccountRefreshAccessTokenExceptionCode.ACCESS_TOKEN_NOT_FOUND:
    case ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED:
    default:
      await handleUnknownException(exception as { message: string }, calendarChannel, workspaceId, calendarChannelSyncStatusService, { captureExceptions });
      break;
  }
}

async function handleSyncCursorErrorException(
  calendarChannel: { id: string },
  workspaceId: string,
  svc: CalendarChannelSyncStatusService,
): Promise<void> {
  await svc.resetAndMarkAsCalendarEventListFetchPending(
    [calendarChannel.id],
    workspaceId,
  );
}

async function handleTemporaryException(
  syncStep: CalendarEventImportSyncStep,
  calendarChannel: { id: string; throttleFailureCount: number },
  workspaceId: string,
  svc: CalendarChannelSyncStatusService,
  { captureExceptions }: ExceptionCapture,
): Promise<void> {
  if (calendarChannel.throttleFailureCount >= CALENDAR_THROTTLE_MAX_ATTEMPTS) {
    await svc.markAsFailedUnknownAndFlushCalendarEventsToImport(
      [calendarChannel.id],
      workspaceId,
    );

    const ex = new CalendarEventImportException(
      `Temporary error occurred ${CALENDAR_THROTTLE_MAX_ATTEMPTS} times while importing calendar events for calendar channel ${calendarChannel.id} in workspace ${workspaceId} with throttleFailureCount ${calendarChannel.throttleFailureCount}`,
      CalendarEventImportExceptionCode.UNKNOWN,
    );

    captureExceptions?.([ex], {
      additionalData: {
        calendarChannelId: calendarChannel.id,
        syncStep,
        throttleFailureCount: calendarChannel.throttleFailureCount,
      },
      workspace: { id: workspaceId },
    });

    throw ex;
  }

  // Increment throttleFailureCount via Mongo.
  const collection = await getCalendarChannelCollection();
  await collection.updateOne(
    { id: calendarChannel.id, workspaceId },
    { $inc: { throttleFailureCount: 1 }, $set: { updatedAt: new Date() } },
  );

  switch (syncStep) {
    case CalendarEventImportSyncStep.CALENDAR_EVENT_LIST_FETCH:
      await svc.markAsCalendarEventListFetchPending(
        [calendarChannel.id],
        workspaceId,
        true,
      );
      break;

    case CalendarEventImportSyncStep.CALENDAR_EVENTS_IMPORT:
      await svc.markAsCalendarEventsImportPending(
        [calendarChannel.id],
        workspaceId,
        true,
      );
      break;

    default:
      break;
  }
}

async function handleInsufficientPermissionsException(
  calendarChannel: { id: string },
  workspaceId: string,
  svc: CalendarChannelSyncStatusService,
): Promise<void> {
  await svc.markAsFailedInsufficientPermissionsAndFlushCalendarEventsToImport(
    [calendarChannel.id],
    workspaceId,
  );
}

async function handleUnknownException(
  exception: { message: string },
  calendarChannel: { id: string },
  workspaceId: string,
  svc: CalendarChannelSyncStatusService,
  { captureExceptions }: ExceptionCapture,
): Promise<void> {
  await svc.markAsFailedUnknownAndFlushCalendarEventsToImport(
    [calendarChannel.id],
    workspaceId,
  );

  const ex = new CalendarEventImportException(
    `Unknown error importing calendar events for calendar channel ${calendarChannel.id} in workspace ${workspaceId}: ${exception.message}`,
    CalendarEventImportExceptionCode.UNKNOWN,
  );

  console.error(exception);
  captureExceptions?.([ex], {
    additionalData: {
      calendarChannelId: calendarChannel.id,
      exceptionMessage: exception.message,
    },
    workspace: { id: workspaceId },
  });

  throw ex;
}

async function handleNotFoundException(
  syncStep: CalendarEventImportSyncStep,
  calendarChannel: { id: string },
  workspaceId: string,
  svc: CalendarChannelSyncStatusService,
): Promise<void> {
  if (syncStep === CalendarEventImportSyncStep.CALENDAR_EVENT_LIST_FETCH) {
    return;
  }

  await svc.resetAndMarkAsCalendarEventListFetchPending(
    [calendarChannel.id],
    workspaceId,
  );
}
