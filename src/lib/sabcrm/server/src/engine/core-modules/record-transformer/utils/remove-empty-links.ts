import "server-only";

// PORT-NOTE: Inlined LinkMetadataNullable type from twenty-shared/types.
// Inlined isDefined and isValidUrl from twenty-shared/utils.
// isNonEmptyString sourced from @sniptt/guards (kept as-is if installed, otherwise inlined).
// RecordTransformerException imported from the ported exception module.

export type LinkMetadataNullable = {
  url: string | null | undefined;
  label: string | null | undefined;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export enum RecordTransformerExceptionCode {
  INVALID_URL = "INVALID_URL",
  INVALID_PHONE_NUMBER = "INVALID_PHONE_NUMBER",
  INVALID_PHONE_COUNTRY_CODE = "INVALID_PHONE_COUNTRY_CODE",
  INVALID_PHONE_CALLING_CODE = "INVALID_PHONE_CALLING_CODE",
  CONFLICTING_PHONE_COUNTRY_CODE = "CONFLICTING_PHONE_COUNTRY_CODE",
  CONFLICTING_PHONE_CALLING_CODE = "CONFLICTING_PHONE_CALLING_CODE",
  CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE = "CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE",
}

export class RecordTransformerException extends Error {
  readonly code: RecordTransformerExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: RecordTransformerExceptionCode,
    options: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = "RecordTransformerException";
    this.code = code;
    this.userFriendlyMessage = options.userFriendlyMessage ?? message;
  }
}

export const removeEmptyLinks = ({
  primaryLinkUrl,
  secondaryLinks,
  primaryLinkLabel,
}: {
  secondaryLinks: LinkMetadataNullable[] | null;
  primaryLinkUrl: string | null;
  primaryLinkLabel: string | null;
}): {
  primaryLinkUrl: string | null;
  primaryLinkLabel: string | null | undefined;
  secondaryLinks: { url: string; label: string | null | undefined }[];
} => {
  const filteredLinks = [
    isNonEmptyString(primaryLinkUrl)
      ? {
          url: primaryLinkUrl,
          label: primaryLinkLabel,
        }
      : null,
    ...(secondaryLinks ?? []),
  ]
    .filter(isDefined)
    .map((link) => {
      if (!isNonEmptyString(link.url)) {
        return undefined;
      }

      return {
        url: link.url,
        label: link.label,
      };
    })
    .filter(isDefined);

  for (const link of filteredLinks) {
    if (!isValidUrl(link.url)) {
      throw new RecordTransformerException(
        "The URL of the link is not valid",
        RecordTransformerExceptionCode.INVALID_URL,
      );
    }
  }

  const firstLink = filteredLinks[0];
  const otherLinks = filteredLinks.slice(1);

  return {
    primaryLinkUrl: firstLink?.url ?? null,
    primaryLinkLabel: firstLink?.label ?? null,
    secondaryLinks: otherLinks,
  };
};
