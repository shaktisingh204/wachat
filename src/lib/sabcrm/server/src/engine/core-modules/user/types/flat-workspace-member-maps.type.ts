import "server-only";

import { type FlatWorkspaceMember } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-workspace-member.type";

export type FlatWorkspaceMemberMaps = {
  byId: Partial<Record<string, FlatWorkspaceMember>>;
  idByUserId: Partial<Record<string, string>>;
};
