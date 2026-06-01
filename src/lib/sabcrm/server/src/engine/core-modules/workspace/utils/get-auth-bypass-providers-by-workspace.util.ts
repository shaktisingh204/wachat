import type { AuthBypassProvidersDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/public-workspace-data.dto";

type WorkspaceBypassFields = {
  isGoogleAuthBypassEnabled: boolean;
  isPasswordAuthBypassEnabled: boolean;
  isMicrosoftAuthBypassEnabled: boolean;
};

export const getAuthBypassProvidersByWorkspace = ({
  workspace,
  systemEnabledProviders,
}: {
  workspace: WorkspaceBypassFields;
  systemEnabledProviders: AuthBypassProvidersDTO;
}): AuthBypassProvidersDTO => {
  return {
    google:
      workspace.isGoogleAuthBypassEnabled && systemEnabledProviders.google,
    password:
      workspace.isPasswordAuthBypassEnabled && systemEnabledProviders.password,
    microsoft:
      workspace.isMicrosoftAuthBypassEnabled &&
      systemEnabledProviders.microsoft,
  };
};
