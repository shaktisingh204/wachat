// PORT-NOTE: pg-migration->mongo-index/seed
// Original: RemoveTiersModeFromBillingPrice1757056320000
// Postgres:
//   up:   ALTER TABLE "core"."billingPrice" DROP COLUMN "tiersMode"
//         DROP TYPE IF EXISTS "core"."billingPrice_tiersmode_enum"
//   down: CREATE TYPE … ENUM('GRADUATED','VOLUME')
//         ALTER TABLE … ADD "tiersMode" …
//
// In MongoDB there is no DDL for enums or column drops. The equivalent:
//   up:   unset the "tiersMode" field from all billingPrice documents.
//   down: no-op (we cannot restore the data).

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_billingprice')
    .updateMany(
      { tiersMode: { $exists: true } },
      { $unset: { tiersMode: '' } },
    );
};

export const down = async (): Promise<void> => {
  // PORT-NOTE: The "tiersMode" data was removed in up(); we cannot restore it.
  // This is a no-op for MongoDB — document the gap.
  console.warn(
    'RemoveTiersModeFromBillingPrice1757056320000 down(): ' +
      'tiersMode field data cannot be restored in MongoDB. No-op.',
  );
};

export const migrationName = 'RemoveTiersModeFromBillingPrice1757056320000';
