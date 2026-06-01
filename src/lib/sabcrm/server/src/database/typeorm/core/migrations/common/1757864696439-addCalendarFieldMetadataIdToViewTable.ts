// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddCalendarFieldMetadataIdToViewTable1757864696439
// Postgres:
//   up:
//     - DROP CONSTRAINT "CHK_VIEW_CALENDAR_LAYOUT_NOT_NULL_WHEN_TYPE_CALENDAR"
//     - ALTER TABLE "view" ADD "calendarFieldMetadataId" uuid
//     - ADD CONSTRAINT "CHK_VIEW_CALENDAR_INTEGRITY"
//       CHECK (type != 'CALENDAR' OR (calendarLayout IS NOT NULL AND calendarFieldMetadataId IS NOT NULL))
//   down: reverses by dropping calendarFieldMetadataId and restoring the old check.
//
// In MongoDB CHECK constraints and DDL column additions have no equivalent.
//   up:   Seed calendarFieldMetadataId = null on view documents that lack it.
//   down: no-op.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_view')
    .updateMany(
      { calendarFieldMetadataId: { $exists: false } },
      { $set: { calendarFieldMetadataId: null } },
    );
};

export const down = async (): Promise<void> => {
  // PORT-NOTE: We leave calendarFieldMetadataId in place to avoid breaking
  // CALENDAR-type views. Remove manually if rolling back is required.
  console.warn(
    'AddCalendarFieldMetadataIdToViewTable1757864696439 down(): ' +
      'calendarFieldMetadataId field is left on view documents.',
  );
};

export const migrationName =
  'AddCalendarFieldMetadataIdToViewTable1757864696439';
