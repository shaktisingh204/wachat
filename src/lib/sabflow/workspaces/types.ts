/**
 * Workspace / team management types for SabFlow.
 *
 * Four roles are supported, in decreasing order of privilege:
 *   owner → admin → editor → viewer
 *
 * Exactly one member of a workspace is the `owner`. Ownership is tracked
 * both on the `Workspace.ownerId` field and on the owner's
 * `WorkspaceMember` row (role = 'owner').
 */

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type WorkspacePlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type Workspace = {
  id: string;
  name: string;
  /** URL-safe unique name, lower-case, a–z 0–9 and dashes only. */
  slug: string;
  ownerId: string;
  iconUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  plan?: WorkspacePlan;
  /** Only populated by list / read helpers that join the `members` collection. */
  memberCount?: number;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedBy?: string;
  joinedAt: Date;
  /** Populated on read by joining against the `users` collection. */
  email?: string;
  /** Populated on read by joining against the `users` collection. */
  name?: string;
};

export type WorkspaceInvite = {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  /** Opaque high-entropy token used as URL param. */
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
};

/* ── Input shapes ─────────────────────────────────────────── */

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
  ownerId: string;
  iconUrl?: string;
  plan?: WorkspacePlan;
};

export type UpdateWorkspaceInput = {
  name?: string;
  slug?: string;
  iconUrl?: string;
  plan?: WorkspacePlan;
};

export type AddWorkspaceMemberInput = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  invitedBy?: string;
};

export type CreateInviteInput = {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  /** TTL in ms. Defaults to 7 days when omitted by the helper. */
  ttlMs?: number;
};
