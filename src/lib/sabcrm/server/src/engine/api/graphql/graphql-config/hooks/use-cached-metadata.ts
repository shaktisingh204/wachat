import "server-only";

import { createHash } from "crypto";

// PORT-NOTE: The original used graphql-yoga's Plugin interface and express Request augmentation.
// In SabNode, this is ported as a plain cache middleware utility for use with the CRM's
// Next.js GraphQL handler. Yoga plugin hooks (onRequest/onResponse) are preserved as
// async functions that callers can invoke around their handler logic.

export type CacheMetadataPluginConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cacheGetter: (key: string) => Promise<any> | any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cacheSetter: (key: string, value: any) => void | Promise<void>;
  operationsToCache: string[];
};

type CachedMetadataRequestContext = {
  workspace?: { id?: string; metadataVersion?: string | number };
  locale?: string;
  userWorkspaceId?: string;
  body: { query: string; operationName?: string };
};

export function computeCacheKey({
  operationName,
  request,
}: {
  operationName: string;
  request: CachedMetadataRequestContext;
}): string {
  const workspace = request.workspace;

  if (!workspace) {
    throw new Error("Workspace is not defined");
  }

  const workspaceMetadataVersion = workspace.metadataVersion ?? "0";
  const locale = request.locale;
  const queryHash = createHash("sha256")
    .update(request.body.query)
    .digest("hex");

  if (operationName === "FindAllViews") {
    return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${request.userWorkspaceId}:${queryHash}`;
  }

  return `graphql:operations:${operationName}:${workspace.id}:${workspaceMetadataVersion}:${locale}:${queryHash}`;
}

/**
 * Checks cache before handling a GraphQL request.
 * Returns the cached response body if found, or null.
 */
export async function checkCachedMetadata(
  config: CacheMetadataPluginConfig,
  request: CachedMetadataRequestContext,
): Promise<unknown | null> {
  const operationName = request.body?.operationName;

  if (!request.workspace?.id || !operationName) {
    return null;
  }

  if (!config.operationsToCache.includes(operationName)) {
    return null;
  }

  const cacheKey = computeCacheKey({ operationName, request });
  const cachedResponse = await config.cacheGetter(cacheKey);

  return cachedResponse ?? null;
}

/**
 * Stores a GraphQL response in cache if appropriate.
 */
export async function storeCachedMetadata(
  config: CacheMetadataPluginConfig,
  request: CachedMetadataRequestContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseBody: any,
): Promise<void> {
  const operationName = request.body?.operationName;

  if (!request.workspace?.id || !operationName) {
    return;
  }

  if (!config.operationsToCache.includes(operationName)) {
    return;
  }

  if (responseBody?.errors) {
    return;
  }

  const cacheKey = computeCacheKey({ operationName, request });
  const existing = await config.cacheGetter(cacheKey);

  if (!existing) {
    await config.cacheSetter(cacheKey, responseBody);
  }
}
