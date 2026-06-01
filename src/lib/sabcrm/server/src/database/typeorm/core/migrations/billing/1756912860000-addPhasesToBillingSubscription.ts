// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddPhasesToBillingSubscription1756912860000
// Postgres: ALTER TABLE "core"."billingSubscription" ADD "phases" jsonb NOT NULL DEFAULT '[]'
//
// In MongoDB the field is schema-optional; no migration DDL is needed.
// This seed function sets a default empty array for all documents that are
// missing the "phases" field, mirroring the Postgres NOT NULL DEFAULT '[]'.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_billingsubscription')
    .updateMany(
      { phases: { $exists: false } },
      { $set: { phases: [] } },
    );
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  // Remove the phases field to reverse the seed.
  await db
    .collection('sabcrm_billingsubscription')
    .updateMany(
      {},
      { $unset: { phases: '' } },
    );
};

export const migrationName = 'AddPhasesToBillingSubscription1756912860000';
