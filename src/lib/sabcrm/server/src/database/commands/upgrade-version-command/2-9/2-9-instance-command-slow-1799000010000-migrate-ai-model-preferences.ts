import "server-only";

// PORT-NOTE: SlowInstanceCommand — migrates the server-level AI_MODEL_PREFERENCES
// key-value-pair to four individual AI_MODELS_DEFAULT_* vars.
// Original uses TypeORM repository against Postgres "core".keyValuePair.
// SabNode port uses MongoDB (sabcrm_keyValuePair collection).

import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

// Inline schema — mirrors aiModelPreferencesSchema from the original
const aiModelPreferencesSchema = z.object({
  defaultFastModels: z.array(z.string()).optional(),
  defaultSmartModels: z.array(z.string()).optional(),
  recommendedModels: z.array(z.string()).optional(),
  disabledModels: z.array(z.string()).optional(),
});

type AiModelPreferences = z.infer<typeof aiModelPreferencesSchema>;

export const KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE = "CONFIG_VARIABLE";

const NEW_KEYS = [
  "AI_MODELS_DEFAULT_FAST",
  "AI_MODELS_DEFAULT_SMART",
  "AI_MODELS_DEFAULT_RECOMMENDED",
  "AI_MODELS_DEFAULT_DISABLED",
] as const;

const PREFERENCE_KEY_MAP: Record<
  (typeof NEW_KEYS)[number],
  keyof AiModelPreferences
> = {
  AI_MODELS_DEFAULT_FAST: "defaultFastModels",
  AI_MODELS_DEFAULT_SMART: "defaultSmartModels",
  AI_MODELS_DEFAULT_RECOMMENDED: "recommendedModels",
  AI_MODELS_DEFAULT_DISABLED: "disabledModels",
};

type KeyValuePairDoc = {
  _id?: unknown;
  id?: string;
  type: string;
  key: string;
  value: unknown;
  userId?: string | null;
  workspaceId?: string | null;
};

/**
 * v2.9.0 — slow instance command #1799000010000
 * Migrates the server-level AI_MODEL_PREFERENCES key-value-pair row to
 * four individual AI_MODELS_DEFAULT_* rows, then deletes the original.
 */
export class MigrateAiModelPreferencesSlowInstanceCommand {
  readonly version = "2.9.0";
  readonly timestamp = 1799000010000;
  readonly type = "slow" as const;

  private readonly logger = {
    log: (msg: string) => console.log(`[MigrateAiModelPreferences] ${msg}`),
    error: (msg: string) => console.error(`[MigrateAiModelPreferences] ${msg}`),
  };

  async runDataMigration(): Promise<void> {
    const { db } = await connectToDatabase();
    const collection = db.collection<KeyValuePairDoc>("sabcrm_keyValuePair");

    const existingRow = await collection.findOne({
      type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
      key: "AI_MODEL_PREFERENCES",
      userId: null,
      workspaceId: null,
    });

    if (existingRow === null) {
      this.logger.log(
        "No server-level AI_MODEL_PREFERENCES row found, skipping",
      );
      return;
    }

    const parseResult = aiModelPreferencesSchema.safeParse(existingRow.value);

    if (!parseResult.success) {
      this.logger.error(
        `Failed to parse server-level AI_MODEL_PREFERENCES: ${parseResult.error.message}`,
      );
      return;
    }

    const prefs = parseResult.data;

    this.logger.log("Migrating server-level AI_MODEL_PREFERENCES");

    // Use a MongoDB session for transaction-like atomicity
    const { client } = await connectToDatabase();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        for (const newKey of NEW_KEYS) {
          const prefField = PREFERENCE_KEY_MAP[newKey];
          const value = prefs[prefField];

          if (value === undefined || (Array.isArray(value) && value.length === 0)) {
            continue;
          }

          const existingNewKeyCount = await collection.countDocuments(
            {
              type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
              key: newKey,
              userId: null,
              workspaceId: null,
            },
            { session },
          );

          if (existingNewKeyCount > 0) {
            continue;
          }

          await collection.insertOne(
            {
              type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
              key: newKey,
              value,
              userId: null,
              workspaceId: null,
            },
            { session },
          );
        }

        await collection.deleteOne(
          { _id: existingRow._id },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    this.logger.log(
      "Migrated server-level AI_MODEL_PREFERENCES to 4 individual vars",
    );
  }

  public async up(): Promise<void> {
    // No Postgres DDL — this command is data-only.
  }

  public async down(): Promise<void> {
    // No Postgres DDL — this command is data-only.
  }
}
