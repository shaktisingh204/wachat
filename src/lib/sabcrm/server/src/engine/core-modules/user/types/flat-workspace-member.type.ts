import "server-only";

// PORT-NOTE: Original type is FlatEntityFrom<WorkspaceMemberWorkspaceEntity>.
// We represent the flat workspace member as a plain TypeScript type mirroring
// the workspace-member standard object fields with dates as ISO strings.

export type FlatWorkspaceMember = {
  id: string;
  userId: string;
  name: {
    firstName: string;
    lastName: string;
  };
  userEmail?: string;
  avatarUrl?: string;
  colorScheme?: string;
  locale?: string;
  timeFormat?: string;
  timeZone?: string;
  dateFormat?: string;
  calendarStartDay?: number;
  numberFormat?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};
