import type { WorkspaceInvitation } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/workspace-invitation.dto";

export type SendInvitationsDTO = {
  /** Boolean that confirms query was dispatched */
  success: boolean;
  errors: string[];
  result: WorkspaceInvitation[];
};
