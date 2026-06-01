// PORT-NOTE: Enterprise license; GraphQL @ObjectType decorators dropped for plain TS type.

import type { SSOConfiguration } from "@/lib/sabcrm/server/src/engine/core-modules/sso/types/SSOConfigurations.type";
import {
  IdentityProviderType,
  SSOIdentityProviderStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity";

export type EditSsoDTO = {
  id: string;
  type: IdentityProviderType;
  issuer: string;
  name: string;
  status: SSOConfiguration["status"];
};
