import "server-only";

// PORT-NOTE: TypeORM Repository + SQL CAST/LIKE replaced with MongoDB $regex/$eq queries.
// TypedReflect / ConfigVariables metadata introspection is preserved as-is but
// depends on @/lib/sabcrm/server/src/engine/core-modules/twenty-config being ported.
// KeyValuePairType enum is inlined to avoid TypeORM entity dependency.

import { connectToDatabase } from "@/lib/mongodb";

import { SECRET_ENCRYPTION_ROTATION_SITE_NAME } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";
import {
  SecretEncryptionRotationHandler,
  type SecretEncryptionRotationContext,
  type SecretEncryptionRotationOutcome,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface";
import { buildRotationErrorMessage } from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/utils/build-rotation-error-message.util";
import { isEncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/is-encrypted-string.util";
import { SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant";
import { type SecretEncryptionService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
import { ConfigVariables } from "@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables";
import { type ConfigVariablesMetadataMap } from "@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/config-variables-metadata.decorator";
import { ConfigVariableType } from "@/lib/sabcrm/server/src/engine/core-modules/twenty-config/enums/config-variable-type.enum";
import { TypedReflect } from "@/lib/sabcrm/server/src/utils/typed-reflect";

// PORT-NOTE: inlined from KeyValuePairEntity — no TypeORM dependency needed.
const KeyValuePairType = {
  CONFIG_VARIABLE: "CONFIG_VARIABLE",
} as const;

type KeyValuePairDoc = {
  id: string;
  type: string;
  key: string;
  value: unknown;
  userId?: string | null;
  workspaceId?: string | null;
};

const COLLECTION = "sabcrm_key_value_pair";

export class SensitiveConfigStorageRotationHandler extends SecretEncryptionRotationHandler {
  readonly siteName =
    SECRET_ENCRYPTION_ROTATION_SITE_NAME.SENSITIVE_CONFIG_STORAGE;

  constructor(
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {
    super();
  }

  private async getCollection() {
    const { db } = await connectToDatabase();
    return db.collection<KeyValuePairDoc>(COLLECTION);
  }

  private collectSensitiveStringConfigKeys(): string[] {
    const metadata = TypedReflect.getMetadata(
      "config-variables",
      ConfigVariables.prototype.constructor,
    ) as ConfigVariablesMetadataMap | undefined;

    if (metadata == null) {
      return [];
    }

    return Object.entries(metadata)
      .filter(
        ([, descriptor]) =>
          descriptor?.isSensitive === true &&
          descriptor?.type === ConfigVariableType.STRING,
      )
      .map(([configKey]) => configKey);
  }

  private buildRotationFilter(
    currentEncryptionKeyId: string,
    sensitiveStringConfigKeys: string[],
  ) {
    const currentEnvelopePrefix = `${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}${currentEncryptionKeyId}:`;
    const notCurrent = new RegExp(
      `^${currentEnvelopePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    );

    return {
      type: KeyValuePairType.CONFIG_VARIABLE,
      userId: null,
      workspaceId: null,
      key: { $in: sensitiveStringConfigKeys },
      value: { $not: notCurrent },
    };
  }

  async countRemaining({
    currentEncryptionKeyId,
  }: {
    currentEncryptionKeyId: string;
  }): Promise<number> {
    const sensitiveStringConfigKeys = this.collectSensitiveStringConfigKeys();

    if (sensitiveStringConfigKeys.length === 0) {
      return 0;
    }

    const collection = await this.getCollection();
    return collection.countDocuments(
      this.buildRotationFilter(currentEncryptionKeyId, sensitiveStringConfigKeys) as Parameters<typeof collection.countDocuments>[0],
    );
  }

  async rotate({
    currentEncryptionKeyId,
    batchSize,
    dryRun,
  }: SecretEncryptionRotationContext): Promise<SecretEncryptionRotationOutcome> {
    const sensitiveStringConfigKeys = this.collectSensitiveStringConfigKeys();

    if (sensitiveStringConfigKeys.length === 0) {
      return { rotated: 0, skipped: 0, errors: 0 };
    }

    const outcome: SecretEncryptionRotationOutcome = {
      rotated: 0,
      skipped: 0,
      errors: 0,
    };

    const collection = await this.getCollection();
    const filter = this.buildRotationFilter(
      currentEncryptionKeyId,
      sensitiveStringConfigKeys,
    );
    let cursor = "00000000-0000-0000-0000-000000000000";

    while (true) {
      const rows = await collection
        .find({ ...(filter as object), id: { $gt: cursor } })
        .sort({ id: 1 })
        .limit(batchSize)
        .toArray();

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const rowOutcome = await this.rotateRow({ row, dryRun });

        outcome.rotated += rowOutcome.rotated;
        outcome.skipped += rowOutcome.skipped;
        outcome.errors += rowOutcome.errors;
      }

      cursor = rows[rows.length - 1].id;
    }

    return outcome;
  }

  private async rotateRow({
    row,
    dryRun,
  }: {
    row: KeyValuePairDoc;
    dryRun: boolean;
  }): Promise<SecretEncryptionRotationOutcome> {
    const rawValue = row.value as unknown;

    if (typeof rawValue !== "string" || rawValue.length === 0 || !isEncryptedString(rawValue)) {
      return { rotated: 0, skipped: 0, errors: 1 };
    }

    try {
      const plaintext = this.secretEncryptionService.decryptVersioned(rawValue);
      const reEncrypted =
        this.secretEncryptionService.encryptVersioned(plaintext);

      if (!dryRun) {
        const collection = await this.getCollection();
        const updateResult = await collection.updateOne(
          { id: row.id, value: rawValue },
          { $set: { value: reEncrypted } },
        );

        if (updateResult.modifiedCount === 0) {
          return { rotated: 0, skipped: 1, errors: 0 };
        }
      }

      return { rotated: 1, skipped: 0, errors: 0 };
    } catch (error) {
      console.error(
        buildRotationErrorMessage(this.siteName, row.id, error),
      );

      return { rotated: 0, skipped: 0, errors: 1 };
    }
  }
}
