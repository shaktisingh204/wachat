// Transforms a links composite field value — validates URLs and normalises origins.

import type { LinkMetadataNullable } from "@/lib/sabcrm/server/src/engine/core-modules/record-transformer/utils/remove-empty-links";
import { removeEmptyLinks } from "@/lib/sabcrm/server/src/engine/core-modules/record-transformer/utils/remove-empty-links";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeUrlOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function isEmpty(value: unknown[] | null | undefined): boolean {
  return !value || value.length === 0;
}

export type LinksFieldGraphQLInput =
  | {
      primaryLinkUrl?: string | null;
      primaryLinkLabel?: string | null;
      secondaryLinks?: string | null;
    }
  | null
  | undefined;

// TODO refactor this function handle partial composite field update
export const transformLinksValue = (
  value: LinksFieldGraphQLInput,
): LinksFieldGraphQLInput => {
  if (!isDefined(value)) {
    return value;
  }

  const primaryLinkUrlRaw = value.primaryLinkUrl as string | null;
  const primaryLinkLabelRaw = value.primaryLinkLabel as string | null;
  const secondaryLinksRaw = value.secondaryLinks as string | null;

  const secondaryLinksArray = isNonEmptyString(secondaryLinksRaw)
    ? parseJson<LinkMetadataNullable[]>(secondaryLinksRaw)
    : secondaryLinksRaw;

  const { primaryLinkLabel, primaryLinkUrl, secondaryLinks } = removeEmptyLinks(
    {
      primaryLinkUrl: primaryLinkUrlRaw,
      primaryLinkLabel: primaryLinkLabelRaw,
      secondaryLinks: secondaryLinksArray as LinkMetadataNullable[] | null,
    },
  );

  const processedSecondaryLinks = secondaryLinks?.map((link) => ({
    ...link,
    url: isDefined(link.url) ? normalizeUrlOrigin(link.url) : link.url,
  }));

  return {
    ...value,
    primaryLinkUrl: isDefined(primaryLinkUrl)
      ? normalizeUrlOrigin(primaryLinkUrl)
      : primaryLinkUrl,
    primaryLinkLabel,
    secondaryLinks: isEmpty(processedSecondaryLinks)
      ? null
      : JSON.stringify(processedSecondaryLinks),
  };
};
