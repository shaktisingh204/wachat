import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Re-encrypted applicationRegistrationVariable rows:
//      rows with non-empty encryptedValue not yet in the v2 envelope were
//      decrypted from the old format and re-encrypted using the instance-scoped
//      versioned envelope (no workspaceId in HKDF info).
//   2. (up) Added a CHECK constraint: encryptedValue = '' OR v2 envelope.
//   3. (down) Dropped the CHECK constraint (without decrypting — security).
//
// In MongoDB:
//   - CHECK constraints do not exist; enforcement is at the application layer.
//   - The backfill IS ported scanning sabcrm_applicationregistrationvariable.
//   - Encryption service callbacks are injected to avoid NestJS DI.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000006000;

const BACKFILL_BATCH_SIZE = 500;
const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';

type ApplicationRegistrationVariableRow = {
  _id: string;
  encryptedValue: string;
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
  const col = db.collection<ApplicationRegistrationVariableRow>(
    'sabcrm_applicationregistrationvariable',
  );

  let lastId: string | null = null;

  while (true) {
    const filter: Record<string, unknown> = {
      encryptedValue: {
        $ne: '',
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
      if (isEncryptedString(row.encryptedValue)) continue;

      const plaintext = decryptVersioned(row.encryptedValue);

      if (plaintext === null) continue;

      const encryptedValue = encryptVersioned(plaintext);

      await col.updateOne(
        { _id: row._id as unknown as string },
        { $set: { encryptedValue } },
      );
    }

    lastId = rows[rows.length - 1]._id;
  }
}

export async function up(): Promise<void> {
  // No-op: MongoDB has no CHECK constraints.
  // Constraint semantics: encryptedValue = '' OR encryptedValue LIKE 'v2:%'
  // are enforced at the application layer.
}

export async function down(): Promise<void> {
  // No-op: intentionally do not decrypt rows on rollback.
}
