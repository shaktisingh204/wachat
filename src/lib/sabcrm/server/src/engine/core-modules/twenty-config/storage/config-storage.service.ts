import "server-only";

// PORT-NOTE: Ported from twenty-server. TypeORM KeyValuePairRepository replaced with a
// MongoDB collection (sabcrm_config_variables). NestJS @Injectable/@InjectRepository removed.
// SecretEncryptionService and ConfigValueConverterService keep the same interface contract
// but are imported from their ported paths.
// isEncryptedString / PlaintextString branded-string helpers are preserved from the ported
// secret-encryption module.

import { connectToDatabase } from '@/lib/mongodb';
import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';
import {
  ConfigVariableException,
  ConfigVariableExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/twenty-config.exception';
import { type ConfigStorageInterface } from './interfaces/config-storage.interface';

/** MongoDB document shape for stored config variables. */
interface ConfigVarDocument {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const COLLECTION_NAME = 'sabcrm_config_variables';

async function getCollection() {
  const { db } = await connectToDatabase();

  return db.collection<ConfigVarDocument>(COLLECTION_NAME);
}

export class ConfigStorageService implements ConfigStorageInterface {
  async get<T extends keyof ConfigVariables>(
    key: T,
  ): Promise<ConfigVariables[T] | undefined> {
    try {
      const col = await getCollection();
      const doc = await col.findOne({ key: key as string });

      if (!doc) {
        return undefined;
      }

      return doc.value as ConfigVariables[T];
    } catch (error) {
      if (error instanceof ConfigVariableException) {
        throw error;
      }

      throw new ConfigVariableException(
        `Failed to retrieve config variable ${key as string}: ${error instanceof Error ? error.message : String(error)}`,
        ConfigVariableExceptionCode.INTERNAL_ERROR,
      );
    }
  }

  async set<T extends keyof ConfigVariables>(
    key: T,
    value: ConfigVariables[T],
  ): Promise<void> {
    try {
      const col = await getCollection();

      await col.updateOne(
        { key: key as string },
        { $set: { key: key as string, value, updatedAt: new Date() } },
        { upsert: true },
      );
    } catch (error) {
      if (error instanceof ConfigVariableException) {
        throw error;
      }

      throw new ConfigVariableException(
        `Failed to save config variable ${key as string}: ${error instanceof Error ? error.message : String(error)}`,
        ConfigVariableExceptionCode.INTERNAL_ERROR,
      );
    }
  }

  async delete<T extends keyof ConfigVariables>(key: T): Promise<void> {
    try {
      const col = await getCollection();

      await col.deleteOne({ key: key as string });
    } catch (error) {
      throw new ConfigVariableException(
        `Failed to delete config variable ${key as string}: ${error instanceof Error ? error.message : String(error)}`,
        ConfigVariableExceptionCode.INTERNAL_ERROR,
      );
    }
  }

  async loadAll(): Promise<
    Map<keyof ConfigVariables, ConfigVariables[keyof ConfigVariables]>
  > {
    try {
      const col = await getCollection();
      const docs = await col.find({}).toArray();

      const result = new Map<
        keyof ConfigVariables,
        ConfigVariables[keyof ConfigVariables]
      >();

      for (const doc of docs) {
        if (doc.value !== null && doc.value !== undefined) {
          result.set(
            doc.key as keyof ConfigVariables,
            doc.value as ConfigVariables[keyof ConfigVariables],
          );
        }
      }

      return result;
    } catch (error) {
      throw new ConfigVariableException(
        `Failed to load all config variables: ${error instanceof Error ? error.message : String(error)}`,
        ConfigVariableExceptionCode.INTERNAL_ERROR,
      );
    }
  }
}
