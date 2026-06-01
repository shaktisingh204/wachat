// PORT-NOTE: Pure type file.
// twenty-shared/types ActorMetadata and engine-internal types inlined since
// twenty-shared is not installed in the SabNode workspace.

import { type CodeExecutionStreamEmitter } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type';

/**
 * Mirrors twenty-shared/types ActorMetadata.
 * Extend if the upstream type grows additional fields.
 */
export type ActorMetadata = {
  workspaceMemberId?: string;
  name?: string;
  [key: string]: unknown;
};

/**
 * Minimal WorkspaceAuthContext shape used by tool providers.
 * Sourced from engine's auth/types/workspace-auth-context.type.
 */
export type WorkspaceAuthContext = {
  workspaceId: string;
  workspaceMemberId?: string;
  userId?: string;
  [key: string]: unknown;
};

/**
 * Minimal RolePermissionConfig shape used by tool providers.
 */
export type RolePermissionConfig = {
  roleId: string;
  permissions: string[];
  [key: string]: unknown;
};

export type ToolProviderContext = {
  workspaceId: string;
  roleId: string;
  rolePermissionConfig: RolePermissionConfig;
  authContext?: WorkspaceAuthContext;
  actorContext?: ActorMetadata;
  userId?: string;
  userWorkspaceId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
};
