import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres slow instance command that:
//   1. (runDataMigration) Re-encrypted secret applicationVariable rows from
//      legacy CTR ciphertext (base64) into the v2 versioned envelope, using
//      SecretEncryptionService.
//   2. (up) Added a CHECK constraint allowing non-secret rows (any value),
//      empty secret rows, or secret rows in the v2 envelope.
//   3. (down) Dropped the CHECK constraint (without decrypting — security).
//
// In MongoDB:
//   - CHECK constraints do not exist; enforcement is at the application layer.
//   - The data-migration backfill IS ported: we scan sabcrm_applicationvariable
//     and re-encrypt isSecret=true rows that are not yet in v2 form.
//   - The SecretEncryptionService is passed as a callback to avoid NestJS DI.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798000005000;

const BACKFILL_BATCH_SIZE = 500;
const SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX = 'v2:';
const LEGACY_CTR_LOOKS_LIKE_BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
const LEGACY_CTR_MIN_LENGTH = 22;

type ApplicationVariableRow = {
  _id: string;
  workspaceId: string;
  value: string;
  isSecret: boolean;
};

type EncryptVersionedFn = (
  plaintext: string,
  opts: { workspaceId: string },
) => string;

type DecryptVersionedFn = (
  ciphertext: string,
  opts: { workspaceId: string },
) => string | null;

const isEncryptedString = (value: string): boolean =>
  value.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX);

const looksLikeLegacyCtrCiphertext = (value: string): boolean =>
  value.length >= LEGACY_CTR_MIN_LENGTH &&
  LEGACY_CTR_LOOKS_LIKE_BASE64_RE.test(value);

export async function runDataMigration(
  encryptVersioned: EncryptVersionedFn,
  decryptVersioned: DecryptVersionedFn,
): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection<ApplicationVariableRow>('sabcrm_applicationvariable');

  let lastId: string | null = null;

  while (true) {
    const filter: Record<string, unknown> = {
      isSecret: true,
      value: { $ne: '', $not: new RegExp(`^${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}`) },
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
      if (!row.isSecret || isEncryptedString(row.value)) continue;

      let plaintext: string | null = null;

      if (looksLikeLegacyCtrCiphertext(row.value)) {
        try {
          plaintext = decryptVersioned(row.value, { workspaceId: row.workspaceId });
        } catch {
          console.warn(
            `applicationVariable row ${row._id} value not valid ciphertext; treating as plaintext.`,
          );
          plaintext = row.value;
        }
      } else {
        console.warn(
          `applicationVariable row ${row._id} value is not base64; treating as plaintext.`,
        );
        plaintext = row.value;
      }

      if (plaintext === null) continue;

      const encryptedValue = encryptVersioned(plaintext, {
        workspaceId: row.workspaceId,
      });

      await col.updateOne({ _id: row._id as unknown as string }, { $set: { value: encryptedValue } });
    }

    lastId = rows[rows.length - 1]._id;
  }
}

export async function up(): Promise<void> {
  // No-op: MongoDB has no CHECK constraints. The CHECK semantics:
  //   (isSecret = false OR value = '' OR value LIKE 'v2:%')
  // are enforced at the application layer.
}

export async function down(): Promise<void> {
  // No-op: intentionally do not decrypt rows on rollback.
}
