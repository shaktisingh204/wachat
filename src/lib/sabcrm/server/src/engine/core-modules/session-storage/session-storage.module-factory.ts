import "server-only";

import RedisStore from "connect-redis";
import { createClient } from "redis";

import type session from "express-session";

import { resolveSessionCookieSecretsOrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/resolve-session-cookie-secrets.util";
import type { SessionCookieConfigService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/resolve-session-cookie-secrets.util";

const SESSION_LOGGER_PREFIX = "[SessionStorage]";
const REDIS_PING_INTERVAL_MS = 60_000;

// Extended config service type needed for session storage
export type SessionStorageConfigService = SessionCookieConfigService & {
  get(key: "SERVER_URL"): string | undefined;
  get(key: "REDIS_URL"): string | undefined;
};

export const getSessionStorageOptions = (
  twentyConfigService: SessionStorageConfigService,
): session.SessionOptions => {
  const SERVER_URL = twentyConfigService.get("SERVER_URL");

  const sessionSecrets = resolveSessionCookieSecretsOrThrow({
    twentyConfigService,
  });

  const sessionStorage: session.SessionOptions = {
    secret: sessionSecrets,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: !!(SERVER_URL && SERVER_URL.startsWith("https")),
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 30, // 30 minutes
    },
  };

  const connectionString = twentyConfigService.get("REDIS_URL");

  if (!connectionString) {
    throw new Error(
      "Redis session storage requires REDIS_URL to be defined, check your .env file",
    );
  }

  const redisClient = createClient({
    url: connectionString,
    pingInterval: REDIS_PING_INTERVAL_MS,
  });

  redisClient.on("error", (err) => {
    console.error(`${SESSION_LOGGER_PREFIX} Redis session-store client error`, err);
  });

  redisClient.connect().catch((err) => {
    throw new Error(`Redis connection failed: ${err}`);
  });

  return {
    ...sessionStorage,
    store: new RedisStore({
      client: redisClient,
      prefix: "engine:session:",
    }),
  };
};
