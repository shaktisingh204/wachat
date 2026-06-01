// PORT-NOTE: Enterprise license; GraphQL @ObjectType decorators dropped for plain TS types.

import type { SSOConfiguration } from "@/lib/sabcrm/server/src/engine/core-modules/sso/types/SSOConfigurations.type";
import {
  IdentityProviderType,
  SSOIdentityProviderStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity";

type WorkspaceNameAndId = {
  displayName?: string | null;
  id: string;
};

export type FindAvailableSSOIDPDTO = {
  type: SSOConfiguration["type"];
  id: string;
  issuer: string;
  name: string;
  status: SSOConfiguration["status"];
  workspace: WorkspaceNameAndId;
};
