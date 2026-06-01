import { type ActorMetadata } from "@/lib/sabcrm/shared/types";

import { type CodeExecutionStreamEmitter } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/code-execution-stream-emitter.type";

import { type WorkspaceAuthContext } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type";

export type ToolContext = {
  workspaceId: string;
  roleId: string;
  authContext?: WorkspaceAuthContext;
  actorContext?: ActorMetadata;
  userId?: string;
  userWorkspaceId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
};
