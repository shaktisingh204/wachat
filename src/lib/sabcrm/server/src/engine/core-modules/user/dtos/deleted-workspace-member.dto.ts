import { type FullNameDTO } from "@/lib/sabcrm/server/src/engine/core-modules/user/dtos/workspace-member.dto";

// PORT-NOTE: NestJS @ObjectType GraphQL DTO → plain TypeScript type.

export type DeletedWorkspaceMemberDTO = {
  id: string;
  name: FullNameDTO;
  userEmail: string;
  avatarUrl: string | null;
  userWorkspaceId: string | null;
};
