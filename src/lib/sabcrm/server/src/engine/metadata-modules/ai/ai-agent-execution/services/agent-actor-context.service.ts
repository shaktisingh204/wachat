import "server-only";

// PORT-NOTE: Ported from twenty-server AgentActorContextService.
// NestJS DI removed; becomes plain exported async functions.
// GlobalWorkspaceOrmManager (TypeORM) replaced with direct Mongo lookups via
// getAgentMessageCollection (or workspace-member collection).
// UserWorkspaceService.findById and UserRoleService.getRoleIdForUserWorkspace
// are injected as callbacks to keep this function pure and testable.
//
// The ActorMetadata / buildCreatedByFromFullNameMetadata pattern is preserved
// as-is — callers must supply a builder that matches the original signature.

export type ActorMetadata = {
  workspaceMemberId: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
  [key: string]: unknown;
};

export type UserContext = {
  firstName: string;
  lastName: string;
  locale: string;
  timezone: string | null;
};

export type AgentActorContext = {
  actorContext: ActorMetadata;
  roleId: string;
  userId: string;
  userWorkspaceId: string;
  userContext: UserContext;
};

export type UserWorkspaceRecord = {
  id: string;
  userId: string;
  locale: string;
};

export type WorkspaceMemberRecord = {
  id: string;
  userId: string;
  name?: { firstName?: string; lastName?: string };
  timeZone?: string | null;
};

export class AiActorContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiActorContextError";
  }
}

/**
 * Builds the user + agent actor context used to execute an AI agent on behalf
 * of a given workspace member.
 *
 * All service dependencies are supplied as callbacks so the function can be
 * used without NestJS DI.
 *
 * @param userWorkspaceId - The userWorkspace record id.
 * @param workspaceId     - The workspace id.
 * @param deps.findUserWorkspace  - Looks up a UserWorkspace by id.
 * @param deps.findWorkspaceMember - Looks up the WorkspaceMember for a userId in a workspace.
 * @param deps.getRoleId  - Returns the roleId for a userWorkspace.
 * @param deps.buildActorContext - Builds ActorMetadata from the workspace member name.
 */
export async function buildUserAndAgentActorContext(
  userWorkspaceId: string,
  workspaceId: string,
  deps: {
    findUserWorkspace: (id: string) => Promise<UserWorkspaceRecord | null>;
    findWorkspaceMember: (
      userId: string,
      workspaceId: string,
    ) => Promise<WorkspaceMemberRecord | null>;
    getRoleId: (params: {
      userWorkspaceId: string;
      workspaceId: string;
    }) => Promise<string | null>;
    buildActorContext: (member: WorkspaceMemberRecord) => ActorMetadata;
  },
): Promise<AgentActorContext> {
  const userWorkspace = await deps.findUserWorkspace(userWorkspaceId);

  if (!userWorkspace) {
    throw new AiActorContextError("User workspace not found");
  }

  const workspaceMember = await deps.findWorkspaceMember(
    userWorkspace.userId,
    workspaceId,
  );

  if (!workspaceMember) {
    throw new AiActorContextError("Workspace member not found for user");
  }

  const roleId = await deps.getRoleId({ userWorkspaceId, workspaceId });

  if (!roleId) {
    throw new AiActorContextError("User role not found");
  }

  const actorContext = deps.buildActorContext(workspaceMember);

  const userContext: UserContext = {
    firstName: workspaceMember.name?.firstName ?? "",
    lastName: workspaceMember.name?.lastName ?? "",
    locale: userWorkspace.locale,
    timezone: workspaceMember.timeZone ?? null,
  };

  return {
    actorContext,
    roleId,
    userId: userWorkspace.userId,
    userWorkspaceId,
    userContext,
  };
}
