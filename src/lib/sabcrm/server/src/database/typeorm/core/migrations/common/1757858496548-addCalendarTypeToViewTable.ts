// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddCalendarTypeToViewTable1757858496548
// Postgres:
//   up:
//     - CREATE TYPE "view_calendarlayout_enum" AS ENUM('DAY','WEEK','MONTH')
//     - ALTER TABLE "view" ADD "calendarLayout" ...
//     - Extend "view_type_enum" to include 'CALENDAR'
//     - ADD CONSTRAINT "CHK_VIEW_CALENDAR_LAYOUT_NOT_NULL_WHEN_TYPE_CALENDAR"
//   down: reverses all of the above.
//
// In MongoDB there are no DDL enums or CHECK constraints. Validation is
// enforced at the application layer.
//   up:   Seed a default calendarLayout = null on existing view documents
//         (they will use it if their type becomes 'CALENDAR').
//   down: no-op (we cannot undo a semantic schema change on documents).

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  // Ensure all existing view documents have the calendarLayout field (null by default).
  await db
    .collection('sabcrm_view')
    .updateMany(
      { calendarLayout: { $exists: false } },
      { $set: { calendarLayout: null } },
    );
};

export const down = async (): Promise<void> => {
  // PORT-NOTE: Removing calendarLayout would break CALENDAR-type views that
  // may have been created after up() ran. We leave the field in place.
  console.warn(
    'AddCalendarTypeToViewTable1757858496548 down(): ' +
      'calendarLayout field is left on view documents. Remove manually if needed.',
  );
};

export const migrationName = 'AddCalendarTypeToViewTable1757858496548';
