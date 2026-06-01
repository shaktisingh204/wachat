import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Migrates AI_MODEL_PREFERENCES config var to four individual AI_MODELS_DEFAULT_* vars,
// per workspace.
// Original uses TypeORM repository against Postgres. SabNode port uses MongoDB.

import { connectToDatabase } from "@/lib/mongodb";
import { z } from "zod";

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  options: { dryRun?: boolean; verbose?: boolean };
};

export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME = "upgrade:2-9:migrate-ai-model-preferences";
export const COMMAND_VERSION = "2.9.0";
export const COMMAND_TIMESTAMP = 1799000000000;

export const KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE = "CONFIG_VARIABLE";

// Inline schema — mirrors aiModelPreferencesSchema from the original
const aiModelPreferencesSchema = z.object({
  defaultFastModels: z.array(z.string()).optional(),
  defaultSmartModels: z.array(z.string()).optional(),
  recommendedModels: z.array(z.string()).optional(),
  disabledModels: z.array(z.string()).optional(),
});

type AiModelPreferences = z.infer<typeof aiModelPreferencesSchema>;

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

// ── Command implementation ────────────────────────────────────────────────────

export class MigrateAiModelPreferencesCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(private readonly logger: CommandLogger = console) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { db } = await connectToDatabase();
    const collection = db.collection<KeyValuePairDoc>("sabcrm_keyValuePair");

    const existingPreferencesRow = await collection.findOne({
      key: "AI_MODEL_PREFERENCES",
      type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
      workspaceId,
      userId: null,
    });

    if (existingPreferencesRow === null) {
      this.logger.log(
        `No AI_MODEL_PREFERENCES row found for workspace ${workspaceId}, skipping`,
      );
      return;
    }

    const parseResult = aiModelPreferencesSchema.safeParse(
      existingPreferencesRow.value,
    );

    if (!parseResult.success) {
      this.logger.error(
        `Failed to parse AI_MODEL_PREFERENCES for workspace ${workspaceId}: ${parseResult.error.message}`,
      );
      return;
    }

    const prefs = parseResult.data;

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Migrating AI_MODEL_PREFERENCES for workspace ${workspaceId}`,
    );

    for (const newKey of NEW_KEYS) {
      const prefField = PREFERENCE_KEY_MAP[newKey];
      const value = prefs[prefField];

      if (
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
      ) {
        continue;
      }

      if (isDryRun) {
        this.logger.log(
          `[DRY RUN] Would insert ${newKey} = ${JSON.stringify(value)} for workspace ${workspaceId}`,
        );
        continue;
      }

      const existingNewKeyRow = await collection.findOne({
        key: newKey,
        type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
        workspaceId,
        userId: null,
      });

      if (existingNewKeyRow !== null) {
        continue;
      }

      await collection.insertOne({
        type: KEY_VALUE_PAIR_TYPE_CONFIG_VARIABLE,
        key: newKey,
        value,
        workspaceId,
        userId: null,
      });
    }

    if (!isDryRun) {
      await collection.deleteOne({ _id: existingPreferencesRow._id });

      this.logger.log(
        `Migrated AI_MODEL_PREFERENCES to 4 individual vars for workspace ${workspaceId}`,
      );
    }
  }
}
