// PORT-NOTE: kind=pg-migration->mongo-index/seed
// The original FlatCacheInvalidateCommand is a NestJS nest-commander CLI command
// that invalidates in-memory flat-entity caches for one or more metadata names
// across all active/suspended workspaces using WorkspaceMigrationRunnerService.
//
// In SabNode (Next.js + Mongo) there is no nest-commander runtime, no BullMQ
// workspace iterator, and no TypeORM query runner — so a CLI runner cannot be
// ported verbatim. The equivalent operation is:
//   1. Resolve which AllFlatEntityMaps cache keys need to be evicted.
//   2. For each workspace, call invalidateCache(...) on the ported
//      WorkspaceMigrationRunnerService.
//
// This module exports a plain async function that performs the same logic
// without any NestJS/Commander decorators, so it can be invoked from a
// Next.js API route, a server action, or a standalone Node script.
//
// Mongo analogue: no index or seed is required — this is pure cache
// invalidation over in-memory/Redis structures. No DDL change needed.

import type { AllFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type";
import { getMetadataFlatEntityMapsKey } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-flat-entity-maps-key.util";
import { getMetadataRelatedMetadataNames } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/get-metadata-related-metadata-names.util";
import type { AllMetadataName } from "@/lib/sabcrm/shared/metadata/all-metadata-name.type";
import { ALL_METADATA_NAME } from "@/lib/sabcrm/shared/metadata/all-metadata-name.constant";

type InvalidateFlatCacheOptions = {
  /** Specific metadata names to invalidate. Ignored when allMetadata is true. */
  metadataNames?: string[];
  /** When true, invalidates cache for every known metadata name. */
  allMetadata?: boolean;
  /** Workspace IDs to target. If omitted the caller must supply them. */
  workspaceIds: string[];
  /** Function that performs the actual cache invalidation for one workspace. */
  invalidateCache: (args: {
    allFlatEntityMapsKeys: (keyof AllFlatEntityMaps)[];
    workspaceId: string;
  }) => Promise<void>;
  logger?: { log: (msg: string) => void; error: (msg: string) => void };
};

function validateAndExpandMetadataNames({
  inputMetadataNames,
  allMetadata,
  logger,
}: {
  inputMetadataNames: string[];
  allMetadata?: boolean;
  logger?: { error: (msg: string) => void; log: (msg: string) => void };
}): AllMetadataName[] | null {
  const validMetadataNames = Object.keys(ALL_METADATA_NAME) as AllMetadataName[];

  if (allMetadata) {
    logger?.log("Using all metadata names");
    return validMetadataNames;
  }

  const invalidNames = inputMetadataNames.filter(
    (name) => !validMetadataNames.includes(name as AllMetadataName),
  );

  if (invalidNames.length > 0) {
    logger?.error(
      `Invalid metadata name(s) provided: ${invalidNames.join(", ")}`,
    );
    logger?.error(
      `Valid metadata names are: ${validMetadataNames.join(", ")}, or use allMetadata: true`,
    );
    return null;
  }

  return inputMetadataNames as AllMetadataName[];
}

function computeFlatMapsKeysWithRelated(
  metadataNames: AllMetadataName[],
): ReturnType<typeof getMetadataFlatEntityMapsKey>[] {
  const allMetadataNamesToFlush = [
    ...new Set([
      ...metadataNames,
      ...metadataNames.flatMap(getMetadataRelatedMetadataNames),
    ]),
  ];

  return allMetadataNamesToFlush.map(getMetadataFlatEntityMapsKey);
}

export async function invalidateFlatCache(
  options: InvalidateFlatCacheOptions,
): Promise<void> {
  const {
    metadataNames: inputNames = [],
    allMetadata,
    workspaceIds,
    invalidateCache,
    logger,
  } = options;

  if (!allMetadata && inputNames.length === 0) {
    logger?.error(
      "Either allMetadata:true or at least one entry in metadataNames must be provided.",
    );
    return;
  }

  const validatedMetadataNames = validateAndExpandMetadataNames({
    inputMetadataNames: inputNames,
    allMetadata,
    logger,
  });

  if (validatedMetadataNames === null) {
    return;
  }

  const flatMapsKeysToFlush = computeFlatMapsKeysWithRelated(validatedMetadataNames);

  logger?.log(
    `Will flush cache for the following flat maps keys: ${flatMapsKeysToFlush.join(", ")}`,
  );

  for (const workspaceId of workspaceIds) {
    await invalidateCache({
      allFlatEntityMapsKeys: flatMapsKeysToFlush,
      workspaceId,
    });
    logger?.log(`Successfully invalidated cache for workspace: ${workspaceId}`);
  }
}
