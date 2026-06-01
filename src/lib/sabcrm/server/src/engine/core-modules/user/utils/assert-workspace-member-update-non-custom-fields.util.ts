// PORT-NOTE: Original used STANDARD_OBJECTS.workspaceMember.fields from
// twenty-shared/metadata to derive the allowlist. We replicate the known
// standard workspace-member fields that are updatable via this endpoint.

class UserInputError extends Error {
  readonly userFriendlyMessage: string;
  constructor(message: string, opts: { userFriendlyMessage?: string } = {}) {
    super(message);
    this.name = "UserInputError";
    this.userFriendlyMessage = opts.userFriendlyMessage ?? message;
  }
}

const WORKSPACE_MEMBER_UPDATE_DISALLOWED_FIELD_NAMES = new Set([
  "id",
  "userId",
]);

// Standard workspace-member fields (mirrored from twenty-shared/metadata)
const WORKSPACE_MEMBER_NON_CUSTOM_UPDATE_FIELD_ALLOWLIST = new Set<string>(
  [
    "name",
    "colorScheme",
    "avatarUrl",
    "locale",
    "timeFormat",
    "timeZone",
    "dateFormat",
    "calendarStartDay",
    "numberFormat",
  ].filter(
    (fieldName) =>
      !WORKSPACE_MEMBER_UPDATE_DISALLOWED_FIELD_NAMES.has(fieldName)
  )
);

export const assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly = ({
  update,
}: {
  update: Record<string, unknown>;
}): void => {
  const updateKeys = Object.keys(update);

  if (updateKeys.length === 0) {
    throw new UserInputError("Update payload cannot be empty", {
      userFriendlyMessage: "Add at least one field to update.",
    });
  }

  for (const payloadKey of updateKeys) {
    if (!WORKSPACE_MEMBER_NON_CUSTOM_UPDATE_FIELD_ALLOWLIST.has(payloadKey)) {
      throw new UserInputError(
        `Cannot update custom workspaceMember field via this endpoint: ${payloadKey}`,
        {
          userFriendlyMessage: `"${payloadKey}" is not a valid workspace member field.`,
        }
      );
    }
  }
};
