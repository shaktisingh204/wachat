// PORT-NOTE: NestJS @ObjectType GraphQL DTOs → plain TypeScript types.
// Class-validator decorators (Min/Max) preserved as JSDoc comments.

export type FullNameDTO = {
  firstName: string;
  lastName: string;
};

export const WorkspaceMemberDateFormatEnum = {
  SYSTEM: "SYSTEM",
  MONTH_FIRST: "MONTH_FIRST",
  DAY_FIRST: "DAY_FIRST",
  YEAR_FIRST: "YEAR_FIRST",
} as const;
export type WorkspaceMemberDateFormatEnum =
  (typeof WorkspaceMemberDateFormatEnum)[keyof typeof WorkspaceMemberDateFormatEnum];

export const WorkspaceMemberTimeFormatEnum = {
  SYSTEM: "SYSTEM",
  HOUR_12: "HOUR_12",
  HOUR_24: "HOUR_24",
} as const;
export type WorkspaceMemberTimeFormatEnum =
  (typeof WorkspaceMemberTimeFormatEnum)[keyof typeof WorkspaceMemberTimeFormatEnum];

export const WorkspaceMemberNumberFormatEnum = {
  SYSTEM: "SYSTEM",
  PERIOD_COMMA: "PERIOD_COMMA",
  COMMA_PERIOD: "COMMA_PERIOD",
  SPACE_PERIOD: "SPACE_PERIOD",
  SPACE_COMMA: "SPACE_COMMA",
  APOSTROPHE_PERIOD: "APOSTROPHE_PERIOD",
} as const;
export type WorkspaceMemberNumberFormatEnum =
  (typeof WorkspaceMemberNumberFormatEnum)[keyof typeof WorkspaceMemberNumberFormatEnum];

export type RoleDTO = {
  id: string;
  label: string;
  description?: string;
  canUpdateAllSettings?: boolean;
};

export type WorkspaceMemberDTO = {
  id: string;
  name: FullNameDTO;
  userEmail: string;
  colorScheme: string;
  avatarUrl?: string | null;
  locale?: string | null;
  /** @min 0 @max 7 */
  calendarStartDay?: number | null;
  timeZone?: string | null;
  dateFormat?: WorkspaceMemberDateFormatEnum | null;
  timeFormat?: WorkspaceMemberTimeFormatEnum | null;
  roles?: RoleDTO[];
  userWorkspaceId?: string | null;
  numberFormat?: WorkspaceMemberNumberFormatEnum | null;
};
