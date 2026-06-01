import "server-only";

// PORT-NOTE: NestJS @OnDatabaseBatchEvent decorator-based listener → plain
// exported async function. The caller must invoke
// handleWorkspaceMemberEvent() from their event-dispatch layer whenever a
// workspaceMember record is created, updated, deleted, destroyed, restored, or
// upserted. The WorkspaceCacheService.invalidateAndRecompute call is preserved
// as a typed callback so the caller can supply the real cache service.

export type WorkspaceMemberEventAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "DESTROYED"
  | "RESTORED"
  | "UPSERTED";

export type WorkspaceMemberEventPayload = {
  workspaceId: string;
  action: WorkspaceMemberEventAction;
  /** Raw event records from the batch (typed loosely here) */
  events: Record<string, unknown>[];
};

export type WorkspaceCacheServiceLike = {
  invalidateAndRecompute(
    workspaceId: string,
    keys: string[],
  ): Promise<void>;
};

export async function handleWorkspaceMemberEvent(
  payload: WorkspaceMemberEventPayload,
  workspaceCacheService: WorkspaceCacheServiceLike,
): Promise<void> {
  await workspaceCacheService.invalidateAndRecompute(payload.workspaceId, [
    "flatWorkspaceMemberMaps",
  ]);
}
