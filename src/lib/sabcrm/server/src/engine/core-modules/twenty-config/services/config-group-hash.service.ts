import "server-only";

// PORT-NOTE: Ported from twenty-server. NestJS @Injectable removed; plain class with
// constructor injection pattern. createHash is Node.js built-in.
// TwentyConfigService imported from its ported target path.

import { createHash } from 'crypto';

import { type ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';
import { type ConfigVariablesGroup } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/enums/config-variables-group.enum';
import { type TwentyConfigService } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/twenty-config.service';
import { TypedReflect } from '@/lib/sabcrm/server/src/utils/typed-reflect';

export class ConfigGroupHashService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  computeHash(group: ConfigVariablesGroup): string {
    const groupVariables = this.getConfigVariablesByGroup(group);

    const configValues = groupVariables
      .map(
        (key) => `${key}=${JSON.stringify(this.twentyConfigService.get(key))}`,
      )
      .sort()
      .join('|');

    return createHash('sha256')
      .update(configValues)
      .digest('hex')
      .substring(0, 16);
  }

  private getConfigVariablesByGroup(
    group: ConfigVariablesGroup,
  ): Array<keyof ConfigVariables> {
    const metadata =
      TypedReflect.getMetadata('config-variables', ConfigVariables) ?? {};

    return Object.keys(metadata)
      .filter((key) => (metadata[key] as { group?: ConfigVariablesGroup })?.group === group)
      .map((key) => key as keyof ConfigVariables);
  }
}
