"use server";

// resolver->action: SearchResolver GraphQL query → Next.js server action.
// Original: @Query() search(...) backed by SearchService + FlatEntityMaps.
// Ported: plain async function accepting the same inputs, returning the same shape.
//
// PORT-NOTE: WorkspaceManyOrAllFlatEntityMapsCacheService and AuthWorkspace are
// replaced by explicit workspaceId + a minimal flatObjectMetadatas array that
// callers must supply (e.g. fetched from the sabcrm metadata collection).
// The RBAC guard (WorkspaceAuthGuard / CustomPermissionGuard) is not replicated
// here — callers must enforce auth before invoking this action.

import "server-only";

import {
  getSearchService,
  type ObjectRecordFilter,
  type SearchResultConnectionDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/services/search.service";
import { type FlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/core-modules/search/types/records-with-object-metadata-item";

export type SearchActionInput = {
  /** The workspace performing the search */
  workspaceId: string;
  /** Text to search for */
  searchInput: string;
  /** Maximum records to return per object type */
  limit?: number;
  /** Extra filter applied to each object collection */
  filter?: ObjectRecordFilter;
  /** When set, restrict to these object types */
  includedObjectNameSingulars?: string[];
  /** When set, exclude these object types */
  excludedObjectNameSingulars?: string[];
  /** Opaque pagination cursor from a previous response */
  after?: string;
  /** All object metadata items available for the workspace */
  flatObjectMetadatas: FlatObjectMetadata[];
};

export async function searchAction(
  input: SearchActionInput,
): Promise<SearchResultConnectionDTO> {
  const {
    workspaceId,
    searchInput,
    limit = 20,
    filter,
    includedObjectNameSingulars,
    excludedObjectNameSingulars,
    after,
    flatObjectMetadatas,
  } = input;

  const service = getSearchService();

  const filteredObjectMetadataItems = service.filterObjectMetadataItems({
    flatObjectMetadatas,
    includedObjectNameSingulars: includedObjectNameSingulars ?? [],
    excludedObjectNameSingulars: excludedObjectNameSingulars ?? [],
  });

  const allRecordsWithObjectMetadataItems =
    await service.getAllRecordsWithObjectMetadataItems({
      flatObjectMetadatas: filteredObjectMetadataItems,
      searchInput,
      limit,
      filter,
      includedObjectNameSingulars,
      excludedObjectNameSingulars,
      after,
      workspaceId,
    });

  return service.computeSearchObjectResults({
    recordsWithObjectMetadataItems: allRecordsWithObjectMetadataItems,
    workspaceId,
    limit,
    after,
  });
}
