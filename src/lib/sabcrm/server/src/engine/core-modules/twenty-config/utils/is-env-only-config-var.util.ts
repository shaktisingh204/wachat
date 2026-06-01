// PORT-NOTE: Ported from twenty-server/src/engine/core-modules/twenty-config/utils/is-env-only-config-var.util.ts
// Pure TypeScript utility — no NestJS/Postgres deps.

import { ConfigVariables } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/config-variables';
import { TypedReflect } from '@/lib/sabcrm/server/src/utils/typed-reflect';

export const isEnvOnlyConfigVar = (key: keyof ConfigVariables): boolean => {
  const metadata =
    TypedReflect.getMetadata('config-variables', ConfigVariables) ?? {};
  const envMetadata = metadata[key as string];

  return !!(envMetadata as { isEnvOnly?: boolean } | undefined)?.isEnvOnly;
};
