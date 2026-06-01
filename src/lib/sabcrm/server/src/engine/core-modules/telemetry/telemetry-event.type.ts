// PORT-NOTE: Pure type file — straight port, no NestJS deps.

export type TelemetryEventType = {
  workspaceId?: string;
  userWorkspaceId?: string;
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  locale?: string;
  serverUrl: string;
  serverId: string;
};
