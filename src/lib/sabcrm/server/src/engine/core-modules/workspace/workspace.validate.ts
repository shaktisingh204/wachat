import {
  AuthException,
  AuthExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/auth/auth.exception";
import { AuthProviderEnum } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/types/workspace.type";
import { type WorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";

const isAuthEnabledOrThrow = (
  provider: AuthProviderEnum,
  workspace: WorkspaceDocument,
  exceptionToThrowCustom: AuthException = new AuthException(
    `${provider} auth is not enabled for this workspace`,
    AuthExceptionCode.OAUTH_ACCESS_DENIED,
  ),
): boolean => {
  if (provider === AuthProviderEnum.Google && workspace.isGoogleAuthEnabled)
    return true;
  if (
    provider === AuthProviderEnum.Microsoft &&
    workspace.isMicrosoftAuthEnabled
  )
    return true;
  if (provider === AuthProviderEnum.Password && workspace.isPasswordAuthEnabled)
    return true;
  if (provider === AuthProviderEnum.SSO) return true;

  throw exceptionToThrowCustom;
};

const isAuthEnabled = (
  provider: AuthProviderEnum,
  workspace: WorkspaceDocument,
): boolean => {
  if (provider === AuthProviderEnum.Google && workspace.isGoogleAuthEnabled)
    return true;
  if (
    provider === AuthProviderEnum.Microsoft &&
    workspace.isMicrosoftAuthEnabled
  )
    return true;
  if (provider === AuthProviderEnum.Password && workspace.isPasswordAuthEnabled)
    return true;

  return false;
};

export const workspaceValidator: {
  isAuthEnabledOrThrow: typeof isAuthEnabledOrThrow;
  isAuthEnabled: typeof isAuthEnabled;
} = {
  isAuthEnabledOrThrow,
  isAuthEnabled,
};
