// PORT-NOTE: ConfigVariablesMaskingStrategies enum is defined in the enums folder.
// We inline it here to keep this file self-contained.

export enum ConfigVariablesMaskingStrategies {
  HIDE_PASSWORD = 'HIDE_PASSWORD',
  LAST_N_CHARS = 'LAST_N_CHARS',
}

type LastNCharsConfig = {
  strategy: ConfigVariablesMaskingStrategies.LAST_N_CHARS;
  chars: number;
};

type HidePasswordConfig = {
  strategy: ConfigVariablesMaskingStrategies.HIDE_PASSWORD;
};

type MaskingConfigType = {
  APP_SECRET: LastNCharsConfig;
  PG_DATABASE_URL: HidePasswordConfig;
  REDIS_URL: HidePasswordConfig;
};

export const CONFIG_VARIABLES_MASKING_CONFIG: MaskingConfigType = {
  APP_SECRET: {
    strategy: ConfigVariablesMaskingStrategies.LAST_N_CHARS,
    chars: 5,
  },
  PG_DATABASE_URL: {
    strategy: ConfigVariablesMaskingStrategies.HIDE_PASSWORD,
  },
  REDIS_URL: {
    strategy: ConfigVariablesMaskingStrategies.HIDE_PASSWORD,
  },
} as const;
