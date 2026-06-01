export type WorkspaceInvitation = {
  id: string;
  email: string;
  roleId?: string | null;
  expiresAt: Date;
};
