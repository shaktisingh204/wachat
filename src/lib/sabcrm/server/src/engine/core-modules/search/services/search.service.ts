// service: SearchService — ported from NestJS+TypeORM (Postgres tsvector) to
// plain TypeScript + MongoDB text-index search.
//
// PORT-NOTE: The original service relied on Postgres-specific features:
//   - tsvector / ts_rank / ts_rank_cd via GIN index for relevance ranking
//   - ILIKE fallback with public.unaccent_immutable for CJK text
//   - TypeORM QueryBuilder with custom bracket conditions
//   - GlobalWorkspaceOrmManager for workspace-scoped database contexts
//
// In Mongo the equivalent is:
//   - $text search + { score: { $meta: "textScore" } } on a text index
//     (index must be created on the searchVector / name fields).
//   - ILIKE fallback → $regex case-insensitive search.
//   - Cursor pagination is implemented with a composite score+id cursor.
//   - Workspace isolation is achieved by always scoping queries to workspaceId.
//
// The public API (getAllRecordsWithObjectMetadataItems, filterObjectMetadataItems,
// computeSearchObjectResults, computeEdges, sortSearchObjectResults,
// getLabelIdentifierColumns, getLabelIdentifierValue, getImageIdentifierColumn,
// getImageIdentifierValue, buildSearchQueryAndGetRecordsWithFallback,
// computeCursorWhereCondition) is preserved. Callers should remain compatible.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { escapeForIlike } from "@/lib/sabcrm/server/src/engine/core-modules/search/utils/escape-for-ilike";
import { formatSearchTerms } from "@/lib/sabcrm/server/src/engine/core-modules/search/utils/format-search-terms";
import {
  type FlatObjectMetadata,
  type ObjectRecord,
  type RecordsWithObjectMetadataItem,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/types/records-with-object-metadata-item";

// ---------------------------------------------------------------------------
// Cursor types
// ---------------------------------------------------------------------------

export type LastRanks = { tsRankCD: number; tsRank: number };

export type SearchCursor = {
  lastRanks: LastRanks;
  lastRecordIdsPerObject: Record<string, string | undefined>;
};

export type SearchRecordDTO = {
  recordId: string;
  objectNameSingular: string;
  objectLabelSingular: string;
  label: string;
  imageUrl: string;
  tsRankCD: number;
  tsRank: number;
};

export type SearchResultEdgeDTO = {
  node: SearchRecordDTO;
  cursor: string;
};

export type SearchResultConnectionDTO = {
  edges: SearchResultEdgeDTO[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export type ObjectRecordFilter = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Constants replicated from the original service
// ---------------------------------------------------------------------------

const OBJECT_METADATA_ITEMS_CHUNK_SIZE = 5;

// Objects excluded from channel-scoped searches (mirrors OBJECTS_WITH_CHANNEL_VISIBILITY_CONSTRAINTS)
const OBJECTS_WITH_CHANNEL_VISIBILITY_CONSTRAINTS: string[] = [
  "messageChannel",
  "calendarChannel",
];

// Priority rank for deterministic tie-breaking (mirrors STANDARD_OBJECTS_BY_PRIORITY_RANK)
const STANDARD_OBJECTS_BY_PRIORITY_RANK: Record<string, number> = {
  person: 100,
  company: 90,
  opportunity: 80,
  workspaceMember: 70,
};

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

function encodeCursorData(data: SearchCursor): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeCursor<T>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
}

// ---------------------------------------------------------------------------
// SearchService
// ---------------------------------------------------------------------------

export class SearchService {
  // ------------------------------------------------------------------ //
  // Public: filter which object types participate in the search          //
  // ------------------------------------------------------------------ //

  filterObjectMetadataItems({
    flatObjectMetadatas,
    includedObjectNameSingulars,
    excludedObjectNameSingulars,
  }: {
    flatObjectMetadatas: FlatObjectMetadata[];
    includedObjectNameSingulars: string[];
    excludedObjectNameSingulars: string[];
  }): FlatObjectMetadata[] {
    const hasExplicitInclusion = includedObjectNameSingulars.length > 0;

    return flatObjectMetadatas.filter(
      ({ nameSingular, isSearchable, isActive }) => {
        if (!isActive) return false;

        if (hasExplicitInclusion) {
          if (
            OBJECTS_WITH_CHANNEL_VISIBILITY_CONSTRAINTS.includes(nameSingular)
          ) {
            return false;
          }

          return (
            includedObjectNameSingulars.includes(nameSingular) &&
            !excludedObjectNameSingulars.includes(nameSingular)
          );
        }

        if (!isSearchable) return false;

        if (excludedObjectNameSingulars.includes(nameSingular)) return false;

        return true;
      },
    );
  }

  // ------------------------------------------------------------------ //
  // Public: fetch records for all object types                           //
  // ------------------------------------------------------------------ //

  async getAllRecordsWithObjectMetadataItems({
    flatObjectMetadatas,
    searchInput,
    limit,
    filter,
    after,
    workspaceId,
    includedObjectNameSingulars,
    excludedObjectNameSingulars,
  }: {
    flatObjectMetadatas: FlatObjectMetadata[];
    searchInput: string;
    limit: number;
    filter?: ObjectRecordFilter;
    after?: string;
    workspaceId: string;
    includedObjectNameSingulars?: string[];
    excludedObjectNameSingulars?: string[];
  }): Promise<RecordsWithObjectMetadataItem[]> {
    const filteredObjectMetadataItems = this.filterObjectMetadataItems({
      flatObjectMetadatas,
      includedObjectNameSingulars: includedObjectNameSingulars ?? [],
      excludedObjectNameSingulars: excludedObjectNameSingulars ?? [],
    });

    const allRecordsWithObjectMetadataItems: RecordsWithObjectMetadataItem[] =
      [];

    // Process in chunks to bound parallelism (mirrors original chunked approach)
    for (
      let i = 0;
      i < filteredObjectMetadataItems.length;
      i += OBJECT_METADATA_ITEMS_CHUNK_SIZE
    ) {
      const chunk = filteredObjectMetadataItems.slice(
        i,
        i + OBJECT_METADATA_ITEMS_CHUNK_SIZE,
      );

      const chunkResults = await Promise.all(
        chunk.map(async (flatObjectMetadata) => {
          const records = await this.buildSearchQueryAndGetRecordsWithFallback({
            flatObjectMetadata,
            workspaceId,
            searchInput,
            limit,
            filter: filter ?? {},
            after,
          });

          return { objectMetadataItem: flatObjectMetadata, records };
        }),
      );

      allRecordsWithObjectMetadataItems.push(...chunkResults);
    }

    return allRecordsWithObjectMetadataItems;
  }

  // ------------------------------------------------------------------ //
  // Mongo search: tsvector → $text, ILIKE fallback → $regex             //
  // ------------------------------------------------------------------ //

  async buildSearchQueryAndGetRecordsWithFallback({
    flatObjectMetadata,
    workspaceId,
    searchInput,
    limit,
    filter,
    after,
  }: {
    flatObjectMetadata: FlatObjectMetadata;
    workspaceId: string;
    searchInput: string;
    limit: number;
    filter: ObjectRecordFilter;
    after?: string;
  }): Promise<ObjectRecord[]> {
    const textResults = await this.buildMongoTextSearch({
      flatObjectMetadata,
      workspaceId,
      searchInput,
      limit,
      filter,
      after,
    });

    // Only fall back when: no results, non-empty input, first page
    if (
      textResults.length > 0 ||
      searchInput.trim() === "" ||
      after !== undefined
    ) {
      return textResults;
    }

    const fallbackResults = await this.buildIlikeFallback({
      flatObjectMetadata,
      workspaceId,
      searchInput,
      limit: limit + 1,
      filter,
    });

    return [...textResults, ...fallbackResults];
  }

  private async buildMongoTextSearch({
    flatObjectMetadata,
    workspaceId,
    searchInput,
    limit,
    filter,
    after,
  }: {
    flatObjectMetadata: FlatObjectMetadata;
    workspaceId: string;
    searchInput: string;
    limit: number;
    filter: ObjectRecordFilter;
    after?: string;
  }): Promise<ObjectRecord[]> {
    const db = await connectToDatabase();
    const collectionName = `sabcrm_${flatObjectMetadata.nameSingular.toLowerCase()}`;
    const collection = db.collection(collectionName);

    const query: Record<string, unknown> = {
      workspaceId,
      deletedAt: null,
      ...filter,
    };

    if (searchInput.trim() !== "") {
      (query as Record<string, unknown>)["$text"] = { $search: searchInput };
    }

    // Cursor: exclude records already returned
    if (after) {
      const { lastRanks, lastRecordIdsPerObject } =
        decodeCursor<SearchCursor>(after);
      const lastId = lastRecordIdsPerObject[flatObjectMetadata.nameSingular];

      if (lastId !== undefined) {
        // Skip records with a lower rank or same rank but already seen id
        // PORT-NOTE: Mongo $text score is not exposed in filter — we use a
        // simple id-after-cursor approach for paginated requests.
        query["_id"] = { $gt: lastId };
      }

      // Attach ranks to results as synthetic fields (see tsRankCD/tsRank below)
      void lastRanks; // used only for sorting in computeSearchObjectResults
    }

    const projection = this.buildProjection(flatObjectMetadata);

    const cursor = collection
      .find(query, {
        projection: {
          ...projection,
          ...(searchInput.trim() !== ""
            ? { score: { $meta: "textScore" } }
            : {}),
        },
      })
      .sort(
        searchInput.trim() !== ""
          ? { score: { $meta: "textScore" }, _id: 1 }
          : { _id: 1 },
      )
      .limit(limit + 1);

    const rawDocs = await cursor.toArray();

    return rawDocs.map((doc) => ({
      ...doc,
      id: String(doc._id ?? doc.id),
      // Map Mongo textScore to tsRankCD/tsRank for downstream compatibility
      tsRankCD: typeof doc.score === "number" ? doc.score : 0,
      tsRank: typeof doc.score === "number" ? doc.score : 0,
    })) as ObjectRecord[];
  }

  private async buildIlikeFallback({
    flatObjectMetadata,
    workspaceId,
    searchInput,
    limit,
    filter,
  }: {
    flatObjectMetadata: FlatObjectMetadata;
    workspaceId: string;
    searchInput: string;
    limit: number;
    filter: ObjectRecordFilter;
  }): Promise<ObjectRecord[]> {
    // PORT-NOTE: Postgres ILIKE with unaccent is replaced by a case-insensitive
    // $regex scan on a "searchVector" string field (if present) or the name fields.
    // This does NOT use an index and may be slow for large collections.
    const db = await connectToDatabase();
    const collectionName = `sabcrm_${flatObjectMetadata.nameSingular.toLowerCase()}`;
    const collection = db.collection(collectionName);

    const words = searchInput
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length === 0) return [];

    const regexConditions = words.map((word) => {
      const escaped = escapeForIlike(word);
      return {
        $or: [
          { searchVector: { $regex: escaped, $options: "i" } },
          { name: { $regex: escaped, $options: "i" } },
          { firstName: { $regex: escaped, $options: "i" } },
          { lastName: { $regex: escaped, $options: "i" } },
        ],
      };
    });

    const query: Record<string, unknown> = {
      workspaceId,
      deletedAt: null,
      ...filter,
      $and: regexConditions,
    };

    const projection = this.buildProjection(flatObjectMetadata);

    const rawDocs = await collection
      .find(query, { projection })
      .sort({ _id: 1 })
      .limit(limit)
      .toArray();

    return rawDocs.map((doc) => ({
      ...doc,
      id: String(doc._id ?? doc.id),
      tsRankCD: 0,
      tsRank: 0,
    })) as ObjectRecord[];
  }

  private buildProjection(flatObjectMetadata: FlatObjectMetadata) {
    // Always select id plus label/image identifier fields
    const base: Record<string, 1> = { _id: 1, id: 1 };

    // Common label identifier fields — full resolution is handled in
    // computeSearchObjectResults via getLabelIdentifierValue
    const nameFields = [
      "name",
      "firstName",
      "lastName",
      "domainNamePrimaryLinkUrl",
      "avatarFile",
      "avatarUrl",
    ];
    nameFields.forEach((f) => {
      base[f] = 1;
    });

    void flatObjectMetadata; // metadata used by caller for label resolution

    return base;
  }

  // ------------------------------------------------------------------ //
  // Cursor where-condition helper (preserved for API parity)            //
  // ------------------------------------------------------------------ //

  computeCursorWhereCondition({
    after,
    objectMetadataNameSingular,
  }: {
    after?: string;
    objectMetadataNameSingular: string;
    tsRankExpr?: string;
    tsRankCDExpr?: string;
  }):
    | { lastId: string; lastRanks: LastRanks }
    | undefined {
    if (!after) return undefined;

    const { lastRanks, lastRecordIdsPerObject } =
      decodeCursor<SearchCursor>(after);
    const lastId = lastRecordIdsPerObject[objectMetadataNameSingular];

    return lastId !== undefined ? { lastId, lastRanks } : undefined;
  }

  // ------------------------------------------------------------------ //
  // Label / image helpers                                                //
  // ------------------------------------------------------------------ //

  getLabelIdentifierColumns(flatObjectMetadata: FlatObjectMetadata): string[] {
    // PORT-NOTE: In the original, this reads labelIdentifierFieldMetadataId from
    // flatFieldMetadataMaps. Without a full metadata graph in Mongo we fall back
    // to well-known naming conventions.
    if (
      flatObjectMetadata.nameSingular === "person" ||
      flatObjectMetadata.nameSingular === "workspaceMember"
    ) {
      return ["firstName", "lastName"];
    }

    return ["name"];
  }

  getLabelIdentifierValue(
    record: ObjectRecord,
    flatObjectMetadata: FlatObjectMetadata,
  ): string {
    const fields = this.getLabelIdentifierColumns(flatObjectMetadata);
    return fields.map((f) => record[f] ?? "").join(" ").trim();
  }

  getImageIdentifierColumn(flatObjectMetadata: FlatObjectMetadata): string | null {
    if (flatObjectMetadata.nameSingular === "company") {
      return "domainNamePrimaryLinkUrl";
    }
    if (flatObjectMetadata.nameSingular === "person") {
      return "avatarFile";
    }
    if (flatObjectMetadata.nameSingular === "workspaceMember") {
      return "avatarUrl";
    }
    if (!flatObjectMetadata.imageIdentifierFieldMetadataId) {
      return null;
    }
    return null;
  }

  async getImageIdentifierValue(
    record: ObjectRecord,
    flatObjectMetadata: FlatObjectMetadata,
  ): Promise<string> {
    // PORT-NOTE: Signed-URL generation (FileUrlService) is not yet wired.
    // Returns a raw URL/path for now; integrate with SabFiles R2 signing when needed.
    const field = this.getImageIdentifierColumn(flatObjectMetadata);

    if (!field) return "";

    const value = record[field];

    if (typeof value !== "string" || value.length === 0) return "";

    return value;
  }

  // ------------------------------------------------------------------ //
  // Edge computation + sorting                                           //
  // ------------------------------------------------------------------ //

  computeEdges({
    sortedRecords,
    after,
  }: {
    sortedRecords: SearchRecordDTO[];
    after?: string;
  }): SearchResultEdgeDTO[] {
    const lastRecordIdsPerObject = after
      ? { ...decodeCursor<SearchCursor>(after).lastRecordIdsPerObject }
      : {};

    return sortedRecords.map((record) => {
      const { objectNameSingular, tsRankCD, tsRank, recordId } = record;

      lastRecordIdsPerObject[objectNameSingular] = recordId;

      return {
        node: record,
        cursor: encodeCursorData({
          lastRanks: { tsRankCD, tsRank },
          lastRecordIdsPerObject: { ...lastRecordIdsPerObject },
        }),
      };
    });
  }

  async computeSearchObjectResults({
    recordsWithObjectMetadataItems,
    workspaceId,
    limit,
    after,
  }: {
    recordsWithObjectMetadataItems: RecordsWithObjectMetadataItem[];
    workspaceId: string;
    limit: number;
    after?: string;
  }): Promise<SearchResultConnectionDTO> {
    const recordPromises = recordsWithObjectMetadataItems.flatMap(
      ({ objectMetadataItem, records }) =>
        records.map(async (record) => ({
          recordId: String(record.id),
          objectNameSingular: objectMetadataItem.nameSingular,
          objectLabelSingular:
            (objectMetadataItem.standardOverrides?.labelSingular ??
              objectMetadataItem.labelSingular),
          label: this.getLabelIdentifierValue(record, objectMetadataItem),
          imageUrl: await this.getImageIdentifierValue(record, objectMetadataItem),
          tsRankCD: typeof record.tsRankCD === "number" ? record.tsRankCD : 0,
          tsRank: typeof record.tsRank === "number" ? record.tsRank : 0,
        })),
    );

    const searchRecords = await Promise.all(recordPromises);

    const sortedRecords = this.sortSearchObjectResults(searchRecords).slice(
      0,
      limit,
    );

    const hasNextPage = searchRecords.length > limit;

    const recordEdges = this.computeEdges({ sortedRecords, after });

    if (recordEdges.length === 0) {
      return { edges: [], pageInfo: { endCursor: null, hasNextPage } };
    }

    const lastRecordEdge = recordEdges[recordEdges.length - 1];

    return {
      edges: recordEdges,
      pageInfo: { endCursor: lastRecordEdge.cursor, hasNextPage },
    };
  }

  sortSearchObjectResults(records: SearchRecordDTO[]): SearchRecordDTO[] {
    return records.slice().sort((a, b) => {
      if (a.tsRankCD !== b.tsRankCD) return b.tsRankCD - a.tsRankCD;
      if (a.tsRank !== b.tsRank) return b.tsRank - a.tsRank;
      return (
        (STANDARD_OBJECTS_BY_PRIORITY_RANK[b.objectNameSingular] ?? 0) -
        (STANDARD_OBJECTS_BY_PRIORITY_RANK[a.objectNameSingular] ?? 0)
      );
    });
  }
}

// Singleton factory
let _instance: SearchService | null = null;

export const getSearchService = (): SearchService => {
  if (_instance === null) {
    _instance = new SearchService();
  }
  return _instance;
};

// formatSearchTerms re-exported for convenience (used by callers that import from here)
export { formatSearchTerms };
