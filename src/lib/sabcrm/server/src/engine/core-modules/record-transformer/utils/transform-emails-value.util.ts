// Transforms an emails composite field value — lowercases primary and additional emails.

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

export type EmailsFieldValue = {
  primaryEmail: string | null;
  additionalEmails: string | null;
};

export const transformEmailsValue = (
  value: unknown,
): EmailsFieldValue | typeof value => {
  if (!isDefined(value)) {
    return value;
  }

  const raw = value as Record<string, unknown>;

  let additionalEmails: string | null =
    (raw?.additionalEmails as string | null) ?? null;

  const primaryEmail = isNonEmptyString(raw?.primaryEmail)
    ? (raw.primaryEmail as string).toLowerCase()
    : null;

  if (additionalEmails) {
    try {
      const emailArray = (
        isNonEmptyString(additionalEmails)
          ? JSON.parse(additionalEmails)
          : additionalEmails
      ) as string[];

      additionalEmails = isNonEmptyArray(emailArray)
        ? JSON.stringify(emailArray.map((email) => email.toLowerCase()))
        : null;
    } catch {
      /* preserve as-is on parse error */
    }
  }

  return {
    primaryEmail,
    additionalEmails,
  };
};
