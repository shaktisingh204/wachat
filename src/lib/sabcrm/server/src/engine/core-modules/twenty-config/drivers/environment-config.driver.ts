// PORT-NOTE: Ported from twenty-server. NestJS @Injectable + @Inject(ConfigService) removed.
// In SabNode, environment variables are read directly via process.env; the default values
// come from a plain ConfigVariables instance passed at construction time.

import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';

export class EnvironmentConfigDriver {
  constructor(
    private readonly defaultConfigVariables: ConfigVariables,
  ) {}

  get<T extends keyof ConfigVariables>(key: T): ConfigVariables[T] {
    const envValue = process.env[key as string];

    if (envValue !== undefined) {
      return envValue as unknown as ConfigVariables[T];
    }

    return this.defaultConfigVariables[key];
  }
}
