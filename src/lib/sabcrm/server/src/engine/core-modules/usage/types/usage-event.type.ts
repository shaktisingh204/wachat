// PORT-NOTE: Enum imports from twenty-server/enums are translated to string
// literal union types — the enums themselves will be ported in their own files.

export type UsageResourceType = string;
export type UsageOperationType = string;
export type UsageUnit = string;

export type UsageEvent = {
  resourceType: UsageResourceType;
  operationType: UsageOperationType;
  creditsUsedMicro: number;
  quantity: number;
  unit: UsageUnit;
  periodStart?: Date;
  resourceId?: string | null;
  resourceContext?: string | null;
  userWorkspaceId?: string | null;
};
