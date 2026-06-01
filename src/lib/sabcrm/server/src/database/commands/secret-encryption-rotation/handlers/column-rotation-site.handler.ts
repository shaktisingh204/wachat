import "server-only";

// PORT-NOTE: The original used TypeORM Repository + QueryBuilder with SQL LIKE.
// In SabNode (Mongo), we replace those with MongoDB collection queries using $not/$regex.
// The abstract SecretEncryptionRotationHandler class is preserved.
// TypeORM-specific types (Repository, SelectQueryBuilder) are replaced with Mongo Collection.

import { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

import { type SecretEncryptionRotationSiteName } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";
import {
  SecretEncryptionRotationHandler,
  type SecretEncryptionRotationContext,
  type SecretEncryptionRotationOutcome,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface";
import { buildCurrentEncryptionKeyIdEnvelopeLikePattern } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/utils/build-current-encryption-key-id-envelope-like-pattern.util";
import { buildRotationErrorMessage } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/utils/build-rotation-error-message.util";
import { isEncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/is-encrypted-string.util";
import { type SecretEncryptionService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

export type ColumnRotationSiteConfig = {
  siteName: SecretEncryptionRotationSiteName;
  /** MongoDB collection name */
  collectionName: string;
  encryptedColumn: string;
  isWorkspaceScoped?: boolean;
  extraWhere?: Record<string, unknown>;
};

function buildNotCurrentKeyRegex(currentEncryptionKeyId: string): RegExp {
  // PORT-NOTE: SQL LIKE `enc:v2:<keyId>:%` -> MongoDB $not $regex `^enc:v2:<keyId>:`
  const prefix = buildCurrentEncryptionKeyIdEnvelopeLikePattern(
    currentEncryptionKeyId,
  ).replace(/%$/, "");
  return new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

export class ColumnRotationSiteHandler extends SecretEncryptionRotationHandler {
  readonly siteName: SecretEncryptionRotationSiteName;

  constructor(
    private readonly config: ColumnRotationSiteConfig,
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {
    super();
    this.siteName = config.siteName;
  }

  private async getCollection(): Promise<Collection<Record<string, unknown>>> {
    const { db } = await connectToDatabase();
    return db.collection(this.config.collectionName);
  }

  private buildFilter(currentEncryptionKeyId: string): Record<string, unknown> {
    const notCurrentKeyRegex = buildNotCurrentKeyRegex(currentEncryptionKeyId);
    const filter: Record<string, unknown> = {
      [this.config.encryptedColumn]: { $not: notCurrentKeyRegex },
      ...(this.config.extraWhere ?? {}),
    };

    return filter;
  }

  async countRemaining({
    currentEncryptionKeyId,
  }: {
    currentEncryptionKeyId: string;
  }): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments(this.buildFilter(currentEncryptionKeyId));
  }

  async rotate({
    currentEncryptionKeyId,
    batchSize,
    dryRun,
  }: SecretEncryptionRotationContext): Promise<SecretEncryptionRotationOutcome> {
    const outcome: SecretEncryptionRotationOutcome = {
      rotated: 0,
      skipped: 0,
      errors: 0,
    };

    const collection = await this.getCollection();
    const filter = this.buildFilter(currentEncryptionKeyId);
    let cursor = ZERO_UUID;

    while (true) {
      const rows = await collection
        .find({ ...filter, id: { $gt: cursor } })
        .sort({ id: 1 })
        .limit(batchSize)
        .toArray();

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const rowId = row.id as string;
        const currentValue = row[this.config.encryptedColumn] as
          | string
          | null
          | undefined;

        if (currentValue == null || !isEncryptedString(currentValue)) {
          console.error(
            `[${this.siteName}] row ${rowId}: column '${this.config.encryptedColumn}' is not a versioned envelope, refusing to rotate.`,
          );
          outcome.errors += 1;
          continue;
        }

        const cryptoOptions = this.config.isWorkspaceScoped
          ? { workspaceId: row.workspaceId as string }
          : undefined;

        try {
          const plaintext = this.secretEncryptionService.decryptVersioned(
            currentValue,
            cryptoOptions,
          );
          const reEncrypted = this.secretEncryptionService.encryptVersioned(
            plaintext,
            cryptoOptions,
          );

          if (!dryRun) {
            const updateResult = await collection.updateOne(
              { id: rowId, [this.config.encryptedColumn]: currentValue },
              { $set: { [this.config.encryptedColumn]: reEncrypted } },
            );

            if (updateResult.modifiedCount === 0) {
              outcome.skipped += 1;
              continue;
            }
          }

          outcome.rotated += 1;
        } catch (error) {
          console.error(
            buildRotationErrorMessage(this.siteName, rowId, error),
          );
          outcome.errors += 1;
        }
      }

      cursor = rows[rows.length - 1].id as string;
    }

    return outcome;
  }
}
