import "server-only";

// PORT-NOTE: Ported directly from Twenty. No NestJS dependencies.
// `digest-fetch` and `tsdav` are third-party packages — ensure they are in
// package.json (pnpm add digest-fetch tsdav).

// @ts-expect-error digest-fetch has no bundled types; install @types/digest-fetch if available
import DigestFetch from "digest-fetch";
import { getBasicAuthHeaders } from "tsdav";

/**
 * Decorates a base fetch with HTTP Basic + Digest authentication.
 *
 * Delegates RFC 7235 / RFC 7616 challenge parsing, hash computation,
 * and 401-then-retry orchestration to `digest-fetch`.
 */
export const createBasicDigestAuthFetch = (
  username: string,
  password: string,
  baseFetch: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch => {
  const digestClient = new DigestFetch(username, password);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  digestClient.getClient = async () => baseFetch;

  const { authorization: basicAuthorization } = getBasicAuthHeaders({
    username,
    password,
  });

  return async (input, init) => {
    const headers = new Headers(init?.headers);

    if (!headers.has("Authorization") && basicAuthorization != null) {
      headers.set("Authorization", basicAuthorization);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return digestClient.fetch(input, {
      ...init,
      headers,
    }) as Promise<Response>;
  };
};
