import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';

export type ConfigKey = keyof ConfigVariables;
export type ConfigValue<T extends ConfigKey> = ConfigVariables[T];

export interface ConfigCacheEntry<T extends ConfigKey> {
  value: ConfigValue<T>;
}
