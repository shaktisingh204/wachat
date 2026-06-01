// PORT-NOTE: Enterprise license; GraphQL @InputType and class-validator decorators
// replaced with plain TS type + zod schema.

import { z } from "zod";

import type { SSOConfiguration } from "@/lib/sabcrm/server/src/engine/core-modules/sso/types/SSOConfigurations.type";
import { SSOIdentityProviderStatus } from "@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity";

export type EditSsoInput = {
  id: string;
  status: SSOConfiguration["status"];
};

export const editSsoInputSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(SSOIdentityProviderStatus),
});
