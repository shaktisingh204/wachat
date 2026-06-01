import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Re-encrypted sensitive config variables stored in
//      keyValuePair (type=CONFIG_VARIABLE, userId IS NULL, workspaceId IS
//      NULL) whose keys are declared `isSensitive=true, type=STRING` in the
//      ConfigVariables metadata. No CHECK constraint was added (the jsonb
//      column is heterogeneous).
//   2. (up/down) No-ops.
//
// In MongoDB:
//   - sabcrm_keyvaluepair documents with type='CONFIG_VARIABLE', no userId,
//     no workspaceId, and a sensitive key are re-encrypted.
//   - The ConfigVariables metadata is unavailable without NestJS DI; caller
//     must pass sensitiveStringKeys as a parameter.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000008000;

const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';

type KeyValuePairRow = {
  _id: string;
  key: string;
  value: unknown;
  type: string;
};

type DecryptVersionedFn = (ciphertext: string) => string | null;
type EncryptVersionedFn = (plaintext: string) => string;

const isEncryptedString = (value: string): boolean =>
  value.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX);

export async function runDataMigration(
  sensitiveStringKeys: string[],
  encryptVersioned: EncryptVersionedFn,
  decryptVersioned: DecryptVersionedFn,
): Promise<void> {
  if (sensitiveStringKeys.length === 0) return;

  const { db } = await connectToDatabase();
  const col = db.collection<KeyValuePairRow>('sabcrm_keyvaluepair');

  for (const key of sensitiveStringKeys) {
    const rows = await col
      .find({
        type: 'CONFIG_VARIABLE',
        userId: { $in: [null, undefined] },
        workspaceId: { $in: [null, undefined] },
        key,
      })
      .toArray();

    for (const row of rows) {
      const rawValue = row.value;

      if (typeof rawValue !== 'string') continue;
      if (rawValue === '' || isEncryptedString(rawValue)) continue;

      const plaintext = decryptVersioned(rawValue);

      if (plaintext === null) continue;

      const encrypted = encryptVersioned(plaintext);

      await col.updateOne(
        { _id: row._id as unknown as string },
        { $set: { value: encrypted } },
      );
    }
  }
}

export async function up(): Promise<void> {
  // No-op: no CHECK constraint added (the value column is heterogeneous).
}

export async function down(): Promise<void> {
  // No-op.
}
