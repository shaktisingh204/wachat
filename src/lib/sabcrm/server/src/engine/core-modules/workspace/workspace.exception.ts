import { CustomException } from "@/lib/sabcrm/server/src/utils/custom-exception";

export enum WorkspaceExceptionCode {
  SUBDOMAIN_NOT_FOUND = "SUBDOMAIN_NOT_FOUND",
  SUBDOMAIN_ALREADY_TAKEN = "SUBDOMAIN_ALREADY_TAKEN",
  SUBDOMAIN_NOT_VALID = "SUBDOMAIN_NOT_VALID",
  DOMAIN_ALREADY_TAKEN = "DOMAIN_ALREADY_TAKEN",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  WORKSPACE_CUSTOM_DOMAIN_DISABLED = "WORKSPACE_CUSTOM_DOMAIN_DISABLED",
  ENVIRONMENT_VAR_NOT_ENABLED = "ENVIRONMENT_VAR_NOT_ENABLED",
  CUSTOM_DOMAIN_NOT_FOUND = "CUSTOM_DOMAIN_NOT_FOUND",
}

const getWorkspaceExceptionUserFriendlyMessage = (
  code: WorkspaceExceptionCode,
): string => {
  switch (code) {
    case WorkspaceExceptionCode.SUBDOMAIN_NOT_FOUND:
      return "Subdomain not found.";
    case WorkspaceExceptionCode.SUBDOMAIN_ALREADY_TAKEN:
      return "This subdomain is already taken.";
    case WorkspaceExceptionCode.SUBDOMAIN_NOT_VALID:
      return "Invalid subdomain.";
    case WorkspaceExceptionCode.DOMAIN_ALREADY_TAKEN:
      return "This domain is already taken.";
    case WorkspaceExceptionCode.WORKSPACE_NOT_FOUND:
      return "Workspace not found.";
    case WorkspaceExceptionCode.WORKSPACE_CUSTOM_DOMAIN_DISABLED:
      return "Custom domains are disabled for this workspace.";
    case WorkspaceExceptionCode.ENVIRONMENT_VAR_NOT_ENABLED:
      return "This feature is not enabled.";
    case WorkspaceExceptionCode.CUSTOM_DOMAIN_NOT_FOUND:
      return "Custom domain not found.";
    default: {
      // exhaustive check — TypeScript will error if a new code is added
      const _exhaustive: never = code;
      return `Unknown workspace error: ${_exhaustive}`;
    }
  }
};

export class WorkspaceException extends CustomException<WorkspaceExceptionCode> {
  constructor(
    message: string,
    code: WorkspaceExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message, code, {
      userFriendlyMessage:
        userFriendlyMessage ?? getWorkspaceExceptionUserFriendlyMessage(code),
    });
  }
}

export const WorkspaceNotFoundDefaultError = new WorkspaceException(
  "Workspace not found",
  WorkspaceExceptionCode.WORKSPACE_NOT_FOUND,
);
