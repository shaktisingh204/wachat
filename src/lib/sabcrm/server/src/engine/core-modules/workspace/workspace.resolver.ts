import "server-only";

// PORT-NOTE: This NestJS GraphQL resolver has been ported to a collection of
// server-only functions and Next.js Server Actions that mirror the original
// queries/mutations. NestJS decorators (@Query, @Mutation, @ResolveField,
// @UseGuards, etc.) are replaced by plain async functions with inline
// auth/permission checks. Wire these into Next.js API route handlers or
// Server Actions as needed.

import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";
import { assertIsDefinedOrThrow } from "@/lib/sabcrm/shared/utils/assert-is-defined-or-throw.util";

import {
  type WorkspaceDocument,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";
import {
  WorkspaceException,
  WorkspaceExceptionCode,
  WorkspaceNotFoundDefaultError,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.exception";
import {
  workspaceGraphqlApiExceptionHandler,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/utils/workspace-graphql-api-exception-handler.util";
import {
  getAuthProvidersByWorkspace,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/utils/get-auth-providers-by-workspace.util";
import {
  type AuthProvidersDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/public-workspace-data.dto";

// ---------------------------------------------------------------------------
// Query: currentWorkspace
// ---------------------------------------------------------------------------
/**
 * Returns the workspace for the authenticated context.
 * Guard equivalent: WorkspaceAuthGuard + NoPermissionGuard
 */
export async function currentWorkspace(
  deps: {
    workspaceService: {
      findById: (id: string) => Promise<WorkspaceDocument | null>;
    };
  },
  workspaceId: string,
): Promise<WorkspaceDocument> {
  const workspace = await deps.workspaceService.findById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");
  return workspace;
}

// ---------------------------------------------------------------------------
// Mutation: activateWorkspace
// ---------------------------------------------------------------------------
export async function activateWorkspace(
  deps: {
    workspaceService: {
      activateWorkspace: (
        user: unknown,
        workspace: WorkspaceDocument,
        data: unknown,
      ) => Promise<WorkspaceDocument>;
    };
  },
  user: unknown,
  workspace: WorkspaceDocument,
  data: unknown,
): Promise<WorkspaceDocument> {
  return deps.workspaceService.activateWorkspace(user, workspace, data);
}

// ---------------------------------------------------------------------------
// Mutation: updateWorkspace
// ---------------------------------------------------------------------------
export async function updateWorkspace(
  deps: {
    workspaceService: {
      updateWorkspaceById: (opts: {
        payload: unknown;
        userWorkspaceId: string;
        apiKey: unknown;
      }) => Promise<WorkspaceDocument>;
    };
  },
  opts: {
    data: Record<string, unknown>;
    workspace: WorkspaceDocument;
    userWorkspaceId: string;
    apiKey: unknown;
  },
): Promise<WorkspaceDocument | undefined> {
  try {
    return await deps.workspaceService.updateWorkspaceById({
      payload: { ...opts.data, id: opts.workspace.id },
      userWorkspaceId: opts.userWorkspaceId,
      apiKey: opts.apiKey,
    });
  } catch (error) {
    workspaceGraphqlApiExceptionHandler(error as Error);
  }
}

// ---------------------------------------------------------------------------
// Mutation: deleteCurrentWorkspace
// ---------------------------------------------------------------------------
export async function deleteCurrentWorkspace(
  deps: {
    workspaceService: {
      suspendWorkspace: (id: string) => Promise<void>;
      deleteWorkspace: (id: string, force: boolean) => Promise<WorkspaceDocument>;
    };
  },
  workspaceId: string,
): Promise<WorkspaceDocument> {
  await deps.workspaceService.suspendWorkspace(workspaceId);
  return deps.workspaceService.deleteWorkspace(workspaceId, true);
}

// ---------------------------------------------------------------------------
// Query: getPublicWorkspaceDataByDomain
// ---------------------------------------------------------------------------
export async function getPublicWorkspaceDataByDomain(
  deps: {
    workspaceDomainsService: {
      getWorkspaceByOriginOrDefaultWorkspace: (
        origin: string,
      ) => Promise<WorkspaceDocument | null>;
      getWorkspaceUrls: (
        workspace: WorkspaceDocument,
      ) => { subdomainUrl: string; customUrl: string };
    };
    fileUrlService: {
      signFileByIdUrl: (opts: {
        fileId: string;
        workspaceId: string;
        fileFolder: string;
      }) => Promise<string>;
    };
    systemEnabledProviders: AuthProvidersDTO;
  },
  opts: {
    originHeader: string;
    origin?: string;
  },
) {
  try {
    if (!opts.origin) {
      return {
        id: "default-workspace",
        logo: "",
        displayName: "Default Workspace",
        workspaceUrls: {
          subdomainUrl: opts.originHeader,
          customUrl: opts.originHeader,
        },
        authProviders: deps.systemEnabledProviders,
      };
    }

    const workspace =
      await deps.workspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace(
        opts.origin,
      );

    assertIsDefinedOrThrow(workspace, WorkspaceNotFoundDefaultError);

    let workspaceLogoWithToken = "";
    if (isDefined(workspace.logoFileId)) {
      workspaceLogoWithToken = await deps.fileUrlService.signFileByIdUrl({
        fileId: workspace.logoFileId,
        workspaceId: workspace.id,
        fileFolder: "CorePicture",
      });
    }

    return {
      id: workspace.id,
      logo: workspaceLogoWithToken,
      displayName: workspace.displayName,
      workspaceUrls: deps.workspaceDomainsService.getWorkspaceUrls(workspace),
      authProviders: getAuthProvidersByWorkspace({
        workspace,
        systemEnabledProviders: deps.systemEnabledProviders,
      }),
    };
  } catch (err) {
    workspaceGraphqlApiExceptionHandler(err as Error);
  }
}

// ---------------------------------------------------------------------------
// Query: getPublicWorkspaceDataById
// ---------------------------------------------------------------------------
export async function getPublicWorkspaceDataById(
  deps: {
    workspaceService: {
      findOneWorkspaceById: (id: string) => Promise<WorkspaceDocument | null>;
    };
    fileUrlService: {
      signFileByIdUrl: (opts: {
        fileId: string;
        workspaceId: string;
        fileFolder: string;
      }) => Promise<string>;
    };
  },
  id: string,
) {
  try {
    const workspace = await deps.workspaceService.findOneWorkspaceById(id);
    assertIsDefinedOrThrow(workspace, WorkspaceNotFoundDefaultError);

    const logo = isDefined(workspace.logoFileId)
      ? await deps.fileUrlService.signFileByIdUrl({
          fileId: workspace.logoFileId,
          workspaceId: workspace.id,
          fileFolder: "CorePicture",
        })
      : (workspace.logo ?? "");

    return {
      id: workspace.id,
      logo,
      displayName: workspace.displayName,
    };
  } catch (err) {
    workspaceGraphqlApiExceptionHandler(err as Error);
  }
}

// ---------------------------------------------------------------------------
// Mutation: checkCustomDomainValidRecords
// ---------------------------------------------------------------------------
export async function checkCustomDomainValidRecords(
  deps: {
    dnsManagerService: {
      refreshHostname: (domain: string) => Promise<unknown>;
    };
    customDomainManagerService: {
      checkCustomDomainValidRecords: (
        workspace: WorkspaceDocument,
        domainValidRecords: unknown,
      ) => Promise<unknown>;
    };
  },
  workspace: WorkspaceDocument,
) {
  if (!workspace.customDomain) {
    throw new WorkspaceException(
      "Custom domain not found",
      WorkspaceExceptionCode.CUSTOM_DOMAIN_NOT_FOUND,
    );
  }

  const domainValidRecords = await deps.dnsManagerService.refreshHostname(
    workspace.customDomain,
  );

  return deps.customDomainManagerService.checkCustomDomainValidRecords(
    workspace,
    domainValidRecords,
  );
}
