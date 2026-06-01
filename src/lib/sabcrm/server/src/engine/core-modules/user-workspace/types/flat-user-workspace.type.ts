import { type USER_WORKSPACE_ENTITY_NON_CACHED_PROPERTIES } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/constants/user-workspace-entity-non-cached-properties.constant";
import { type UserWorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.entity";

// PORT-NOTE: Original FlatUserWorkspace omitted relation-heavy fields and
// converted Date columns to ISO strings. Same pattern applied to the Mongo
// document: Date fields become string, non-cached fields are omitted.

type UserWorkspaceEntityNonCachedProperties =
  (typeof USER_WORKSPACE_ENTITY_NON_CACHED_PROPERTIES)[number];

type UserWorkspaceCachedFields = Omit<
  UserWorkspaceDocument,
  UserWorkspaceEntityNonCachedProperties
>;

// Convert Date fields to string (mirrors the TypeORM CastRecordTypeOrmDatePropertiesToString helper)
type DateToString<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null | undefined
      ? string | null | undefined
      : T[K];
};

export type FlatUserWorkspace = DateToString<UserWorkspaceCachedFields>;
