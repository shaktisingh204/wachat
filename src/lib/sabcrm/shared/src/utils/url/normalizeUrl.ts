import { ensureAbsoluteUrl } from '@/lib/sabcrm/shared/src/utils/url/ensureAbsoluteUrl';
import { normalizeUrlOrigin } from '@/lib/sabcrm/shared/src/utils/url/normalizeUrlOrigin';

// Ensures the URL has a protocol, lowercases the origin, and removes a trailing slash.
export const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();

  if (trimmed === '') {
    return trimmed;
  }

  return normalizeUrlOrigin(ensureAbsoluteUrl(trimmed));
};
