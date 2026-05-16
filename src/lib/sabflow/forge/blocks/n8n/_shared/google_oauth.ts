/**
 * Shared OAuth helpers for Google and Microsoft forge blocks.
 *
 * Both providers use the OAuth 2.0 refresh-token grant. Google posts to
 * https://oauth2.googleapis.com/token; Microsoft (Graph) posts to
 * https://login.microsoftonline.com/common/oauth2/v2.0/token.
 *
 * Credentials must have { clientId, clientSecret, refreshToken }.
 */

import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from './oauth';
import { requireCredential } from './http';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export async function getOrRefreshAccessToken(
  service: string,
  credential: Record<string, string> | undefined,
  tokenUrl: string,
  extraFields?: Record<string, string>,
): Promise<string> {
  const cred = requireCredential(service, credential);
  const clientId = cred.clientId;
  const clientSecret = cred.clientSecret;
  const refreshToken = cred.refreshToken;
  if (!clientId) throw new Error(`${service}: credential is missing \`clientId\``);
  if (!clientSecret) throw new Error(`${service}: credential is missing \`clientSecret\``);
  if (!refreshToken) throw new Error(`${service}: credential is missing \`refreshToken\``);

  const key = cacheKeyFor(service, refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;

  const { accessToken, expiresIn } = await refreshAccessToken({
    service,
    tokenUrl,
    refreshToken,
    clientId,
    clientSecret,
    extraFields,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}
