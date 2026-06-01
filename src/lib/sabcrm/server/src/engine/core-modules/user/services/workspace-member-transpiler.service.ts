import "server-only";

// PORT-NOTE: Original had NestJS DI + FileUrlService injection.
// File URL signing is platform-specific; we expose stubs that callers can
// swap for SabNode's R2-based signing. The transpile logic is preserved fully.

export type RoleDto = {
  id: string;
  name: string;
  label?: string;
};

export type WorkspaceMemberDTO = {
  id: string;
  name: { firstName: string; lastName: string };
  userEmail: string;
  avatarUrl: string;
  userWorkspaceId: string;
  colorScheme?: string;
  dateFormat?: string;
  locale?: string;
  timeFormat?: string;
  timeZone?: string;
  roles: RoleDto[];
  calendarStartDay?: number;
  numberFormat?: string;
};

export type DeletedWorkspaceMemberDTO = {
  id: string;
  name: { firstName: string; lastName: string };
  userEmail: string;
  avatarUrl: string | null;
  userWorkspaceId: string | null;
};

export type WorkspaceMemberLike = {
  id: string;
  userId: string;
  name: { firstName: string; lastName: string };
  userEmail?: string | null;
  avatarUrl?: string | null;
  colorScheme?: string;
  locale?: string;
  timeFormat?: string;
  timeZone?: string;
  dateFormat?: string;
  calendarStartDay?: number;
  numberFormat?: string;
};

export type UserWorkspaceLike = {
  id: string;
  workspaceId: string;
  userId: string;
  locale?: string;
};

export type ToWorkspaceMemberDtoArgs = {
  workspaceMemberEntity: WorkspaceMemberLike;
  userWorkspaceRoles: { id: string; name: string; label?: string }[];
  userWorkspace: UserWorkspaceLike;
};

export type FileUrlSignerLike = {
  signFileByIdUrl(opts: {
    fileId: string;
    workspaceId: string;
    fileFolder: string;
  }): Promise<string>;
  extractFileIdFromUrl(url: string, folder: string): string | undefined;
};

export class WorkspaceMemberTranspiler {
  constructor(private readonly fileUrlService?: FileUrlSignerLike) {}

  async generateSignedAvatarUrl({
    workspaceId,
    workspaceMember,
  }: {
    workspaceMember: Pick<WorkspaceMemberLike, "avatarUrl" | "id">;
    workspaceId: string;
  }): Promise<string> {
    if (!workspaceMember.avatarUrl) {
      return "";
    }

    if (!this.fileUrlService) {
      // No signer available — return the raw URL
      return workspaceMember.avatarUrl;
    }

    const fileId = this.fileUrlService.extractFileIdFromUrl(
      workspaceMember.avatarUrl,
      "CorePicture"
    );

    if (!fileId) {
      return "";
    }

    return this.fileUrlService.signFileByIdUrl({
      fileId,
      workspaceId,
      fileFolder: "CorePicture",
    });
  }

  async toWorkspaceMemberDto({
    userWorkspace,
    workspaceMemberEntity,
    userWorkspaceRoles,
  }: ToWorkspaceMemberDtoArgs): Promise<WorkspaceMemberDTO> {
    const {
      avatarUrl: avatarUrlFromEntity,
      id,
      name,
      userEmail,
      colorScheme,
      locale,
      timeFormat,
      timeZone,
      dateFormat,
      calendarStartDay,
      numberFormat,
    } = workspaceMemberEntity;

    const avatarUrl = await this.generateSignedAvatarUrl({
      workspaceId: userWorkspace.workspaceId,
      workspaceMember: {
        avatarUrl: avatarUrlFromEntity ?? null,
        id,
      },
    });

    const roles: RoleDto[] = userWorkspaceRoles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
    }));

    if (!userEmail) {
      throw new Error(`Workspace member ${id} has no userEmail`);
    }

    return {
      id,
      name,
      userEmail,
      avatarUrl,
      userWorkspaceId: userWorkspace.id,
      colorScheme,
      dateFormat,
      locale,
      timeFormat,
      timeZone,
      roles,
      calendarStartDay,
      numberFormat,
    };
  }

  async toWorkspaceMemberDtos(
    allWorkspaceEntitiesBundles: ToWorkspaceMemberDtoArgs[]
  ): Promise<WorkspaceMemberDTO[]> {
    return Promise.all(
      allWorkspaceEntitiesBundles.map((bundle) =>
        this.toWorkspaceMemberDto(bundle)
      )
    );
  }

  async toDeletedWorkspaceMemberDto(
    workspaceMember: WorkspaceMemberLike,
    userWorkspaceId?: string
  ): Promise<DeletedWorkspaceMemberDTO> {
    const { avatarUrl: avatarUrlFromEntity, id, name, userEmail } =
      workspaceMember;

    if (!userEmail) {
      throw new Error(`Workspace member ${id} has no userEmail`);
    }

    const avatarUrl = userWorkspaceId
      ? await this.generateSignedAvatarUrl({
          workspaceId: userWorkspaceId,
          workspaceMember: {
            avatarUrl: avatarUrlFromEntity ?? null,
            id,
          },
        })
      : null;

    return {
      id,
      name,
      userEmail,
      avatarUrl,
      userWorkspaceId: userWorkspaceId ?? null,
    };
  }

  async toDeletedWorkspaceMemberDtos(
    workspaceMembers: WorkspaceMemberLike[],
    userWorkspaceId?: string
  ): Promise<DeletedWorkspaceMemberDTO[]> {
    return Promise.all(
      workspaceMembers.map((workspaceMember) =>
        this.toDeletedWorkspaceMemberDto(workspaceMember, userWorkspaceId)
      )
    );
  }
}
