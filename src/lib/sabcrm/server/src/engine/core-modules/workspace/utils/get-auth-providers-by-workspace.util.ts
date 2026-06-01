import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";

import {
  SSOIdentityProviderStatus,
  type WorkspaceSSOIdentityProviderDocument,
} from "@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity";
import { type AuthProvidersDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/public-workspace-data.dto";
import { type WorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";

export const getAuthProvidersByWorkspace = ({
  workspace,
  systemEnabledProviders,
}: {
  workspace: Pick<
    WorkspaceDocument,
    | "isGoogleAuthEnabled"
    | "isPasswordAuthEnabled"
    | "isMicrosoftAuthEnabled"
    | "workspaceSSOIdentityProviders"
  >;
  systemEnabledProviders: AuthProvidersDTO;
}) => {
  return {
    google: workspace.isGoogleAuthEnabled && systemEnabledProviders.google,
    magicLink: false,
    password:
      workspace.isPasswordAuthEnabled && systemEnabledProviders.password,
    microsoft:
      workspace.isMicrosoftAuthEnabled && systemEnabledProviders.microsoft,
    sso: (workspace.workspaceSSOIdentityProviders ?? [])
      .map((identityProvider: WorkspaceSSOIdentityProviderDocument) =>
        identityProvider.status === SSOIdentityProviderStatus.Active
          ? {
              id: identityProvider._id?.toString() ?? identityProvider.id,
              name: identityProvider.name,
              type: identityProvider.type,
              status: identityProvider.status,
              issuer: identityProvider.issuer,
            }
          : undefined,
      )
      .filter(isDefined),
  };
};
