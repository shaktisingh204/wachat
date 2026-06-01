import "server-only";

// PORT-NOTE: NestJS @Injectable service → plain exported async function.
// SecureHttpClientService replaced with createSecureHttpClientService().

import { DAVClient } from "tsdav";

import {
  createSecureHttpClientService,
} from "@/lib/sabcrm/server/src/engine/core-modules/secure-http-client/secure-http-client.service";
import {
  createBasicDigestAuthFetch,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/lib/auth/create-basic-digest-auth-fetch";

export type CalDavConnectionParams = {
  serverUrl: string;
  username: string;
  password: string;
};

/**
 * Creates and logs in a CalDAV client using SSRF-safe fetch + Basic/Digest auth.
 */
export async function getCalDavClient(
  input: CalDavConnectionParams,
): Promise<DAVClient> {
  const secureHttpClientService = createSecureHttpClientService();
  const ssrfSafeFetch = secureHttpClientService.createSsrfSafeFetch();

  const fetch = createBasicDigestAuthFetch(
    input.username,
    input.password,
    ssrfSafeFetch,
  );

  const client = new DAVClient({
    serverUrl: input.serverUrl,
    credentials: { username: input.username, password: input.password },
    authMethod: "Custom",
    // our fetch handles Basic+Digest itself; no-op authFunction so tsdav doesn't add its own header on top
    authFunction: async () => ({}),
    defaultAccountType: "caldav",
    fetch,
  });

  await client.login();

  return client;
}
