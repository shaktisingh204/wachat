import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Re-encrypted signingKey.privateKey rows from the old
//      format into the instance-scoped v2 versioned envelope (no workspaceId).
//   2. (up) Added a CHECK constraint: privateKey IS NULL OR LIKE 'v2:%'.
//   3. (down) Dropped the CHECK constraint (without decrypting — security).
//
// In MongoDB:
//   - CHECK constraints do not exist; enforcement is at the application layer.
//   - The backfill IS ported scanning sabcrm_signingkey in batches.
//   - Encryption service callbacks are injected to avoid NestJS DI.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000007000;

const BACKFILL_BATCH_SIZE = 200;
const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';

type SigningKeyRow = {
  _id: string;
  privateKey: string | null;
};

type DecryptVersionedFn = (ciphertext: string) => string | null;
type EncryptVersionedFn = (plaintext: string) => string;

const isEncryptedString = (value: string): boolean =>
  value.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX);

export async function runDataMigration(
  encryptVersioned: EncryptVersionedFn,
  decryptVersioned: DecryptVersionedFn,
): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection<SigningKeyRow>('sabcrm_signingkey');

  let lastId: string | null = null;

  while (true) {
    const filter: Record<string, unknown> = {
      privateKey: {
        $ne: null,
        $not: new RegExp(`^${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}`),
      },
    };

    if (lastId !== null) {
      filter['_id'] = { $gt: lastId };
    }

    const rows = await col
      .find(filter)
      .sort({ _id: 1 })
      .limit(BACKFILL_BATCH_SIZE)
      .toArray();

    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.privateKey || isEncryptedString(row.privateKey)) continue;

      const plaintext = decryptVersioned(row.privateKey);

      if (plaintext === null) continue;

      const encryptedPrivateKey = encryptVersioned(plaintext);

      await col.updateOne(
        { _id: row._id as unknown as string },
        { $set: { privateKey: encryptedPrivateKey } },
      );
    }

    lastId = rows[rows.length - 1]._id;
  }
}

export async function up(): Promise<void> {
  // No-op: MongoDB has no CHECK constraints.
  // Constraint semantics: privateKey IS NULL OR LIKE 'v2:%'
  // are enforced by the application layer (JwtKeyManagerService).
}

export async function down(): Promise<void> {
  // No-op: intentionally do not decrypt rows on rollback (security regression).
}
