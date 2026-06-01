// PORT-NOTE: pg-migration->mongo-index/seed
// Original: EditableProfileFields1762884796640
//
// This Postgres migration adds an array column to "workspace":
//   "editableProfileFields" character varying[] DEFAULT '{email,profilePicture,firstName,lastName}'
//
// Mongo equivalent: Back-fill existing sabcrm_workspace documents that do not
// yet have the field with the same default value.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1762884796640-editableProfileFields';

export const DEFAULT_EDITABLE_PROFILE_FIELDS = [
  'email',
  'profilePicture',
  'firstName',
  'lastName',
] as const;

export type EditableProfileField = (typeof DEFAULT_EDITABLE_PROFILE_FIELDS)[number];

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_workspace').updateMany(
    { editableProfileFields: { $exists: false } },
    { $set: { editableProfileFields: [...DEFAULT_EDITABLE_PROFILE_FIELDS] } },
  );
}
