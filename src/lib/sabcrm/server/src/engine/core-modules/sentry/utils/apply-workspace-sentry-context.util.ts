import "server-only";

import { applyWorkspaceSentryFields } from "@/lib/sabcrm/server/src/engine/core-modules/sentry/utils/apply-workspace-sentry-fields.util";

// Minimal shape of the auth context needed here — avoids pulling in the full
// workspace auth type tree before it is ported.
type WorkspaceAuthContextMinimal = {
  type:
    | "user"
    | "pendingActivationUser"
    | "apiKey"
    | "application"
    | "system";
  workspace?: { id?: string } | null;
  userWorkspaceId?: string;
};

export const applyWorkspaceSentryContext = (
  authContext: WorkspaceAuthContextMinimal,
): void => {
  const workspaceId = authContext.workspace?.id;

  if (!workspaceId) {
    return;
  }

  switch (authContext.type) {
    case "user":
    case "pendingActivationUser":
      applyWorkspaceSentryFields({
        workspaceId,
        userWorkspaceId: authContext.userWorkspaceId,
      });
      return;
    case "apiKey":
    case "application":
    case "system":
      applyWorkspaceSentryFields({ workspaceId });
      return;
  }
};
