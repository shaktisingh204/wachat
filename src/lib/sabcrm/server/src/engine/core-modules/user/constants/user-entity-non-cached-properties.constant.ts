// PORT-NOTE: Typed against the ported UserDocument shape rather than the
// original TypeORM UserEntity. Fields that were TypeORM-only (virtual getters,
// relation arrays) are mapped to their Mongo equivalents.
// The ported UserEntity is declared in ../user.entity.ts (to be ported in a
// later batch). We use a structural type here to keep this file self-contained.

type UserDocumentShape = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash?: string | null;
  locale?: string;
  // Relation id arrays (Mongo pattern)
  appTokenIds?: string[];
  keyValuePairIds?: string[];
  userWorkspaceIds?: string[];
  // Computed / virtual
  onboardingStatus?: string;
  currentWorkspaceId?: string;
  currentUserWorkspaceId?: string;
};

export const USER_ENTITY_NON_CACHED_PROPERTIES = [
  "passwordHash",
  "appTokenIds",
  "keyValuePairIds",
  "userWorkspaceIds",
  "onboardingStatus",
  "currentWorkspaceId",
  "currentUserWorkspaceId",
] as const satisfies ReadonlyArray<keyof UserDocumentShape>;
