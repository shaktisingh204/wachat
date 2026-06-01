import 'server-only';

// PORT-NOTE: Ported from twenty-server FindRecordsService.
// NestJS DI removed; exported as a plain async function.
// CommonFindManyQueryRunnerService replaced with direct Mongo find.
// QUERY_MAX_RECORDS inlined (original: 1000).
// OrderByDirection / objectRecordOrderBy -> Mongo sort document.

import { connectToDatabase } from '@/lib/mongodb';

import { getRecordDisplayName } from '../utils/get-record-display-name.util';
import { type FindRecordsParams } from '../types/find-records-params.type';
import { type FindRecordsResult } from '../types/find-records-result.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type FlatEntityMaps, type FlatFieldMetadata, type FlatObjectMetadata } from '../types/object-metadata-for-tool-schema.type';
import { buildCommonApiContext, type ObjectsPermissions } from './common-api-context-builder.service';

// PORT-NOTE: QUERY_MAX_RECORDS constant from twenty-shared/constants.
const QUERY_MAX_RECORDS = 1000;

export type FindRecordsServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function findCrmRecords(
  params: FindRecordsParams,
  deps: FindRecordsServiceDeps,
): Promise<ToolOutput<FindRecordsResult>> {
  const {
    objectName,
    filter,
    orderBy,
    limit,
    offset = 0,
    authContext,
  } = params;

  try {
    const {
      flatObjectMetadata,
      flatFieldMetadataMaps,
    } = await buildCommonApiContext({
      authContext,
      objectName,
      flatObjectMetadataMaps: deps.flatObjectMetadataMaps,
      flatFieldMetadataMaps: deps.flatFieldMetadataMaps,
      objectsPermissions: deps.objectsPermissions,
    });

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    // Build Mongo filter from gqlOperationFilter or direct filter
    let mongoFilter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter && typeof filter === 'object' && !Array.isArray(filter)) {
      const filterObj = filter as Record<string, unknown>;
      // Handle gqlOperationFilter array
      if (Array.isArray(filterObj.gqlOperationFilter)) {
        mongoFilter = { ...mongoFilter, $and: filterObj.gqlOperationFilter };
      } else {
        mongoFilter = { ...mongoFilter, ...filterObj };
      }
    } else if (Array.isArray(filter)) {
      mongoFilter = { ...mongoFilter, $and: filter };
    }

    // Build Mongo sort from orderBy
    let mongoSort: Record<string, 1 | -1> = { id: 1 };
    if (orderBy && typeof orderBy === 'object' && !Array.isArray(orderBy)) {
      const sortDoc: Record<string, 1 | -1> = {};
      for (const [field, direction] of Object.entries(orderBy as Record<string, unknown>)) {
        if (typeof direction === 'string') {
          sortDoc[field] = direction.includes('Desc') ? -1 : 1;
        }
      }
      if (Object.keys(sortDoc).length > 0) {
        mongoSort = { ...sortDoc, id: 1 };
      }
    } else if (Array.isArray(orderBy)) {
      const sortDoc: Record<string, 1 | -1> = {};
      for (const entry of orderBy as Record<string, unknown>[]) {
        for (const [field, direction] of Object.entries(entry)) {
          if (typeof direction === 'string') {
            sortDoc[field] = direction.includes('Desc') ? -1 : 1;
          }
        }
      }
      if (Object.keys(sortDoc).length > 0) {
        mongoSort = { ...sortDoc, id: 1 };
      }
    }

    const clampedLimit = limit
      ? Math.min(limit, QUERY_MAX_RECORDS)
      : QUERY_MAX_RECORDS;

    const [records, totalCount] = await Promise.all([
      collection
        .find(mongoFilter)
        .sort(mongoSort)
        .skip(offset)
        .limit(clampedLimit)
        .toArray(),
      collection.countDocuments(mongoFilter),
    ]);

    console.log(`[findCrmRecords] Found ${records.length} records in ${objectName}`);

    const recordReferences = records.map((record) => ({
      objectNameSingular: objectName,
      recordId: String((record as Record<string, unknown>).id ?? record._id),
      displayName: getRecordDisplayName(
        record as Record<string, unknown>,
        flatObjectMetadata,
        flatFieldMetadataMaps,
      ),
    }));

    return {
      success: true,
      message: `Found ${records.length} ${objectName} records`,
      result: {
        records,
        count: totalCount,
      },
      recordReferences,
    };
  } catch (error) {
    console.error(`[findCrmRecords] Failed to find records: ${error}`);

    return {
      success: false,
      message: `Failed to find ${objectName} records`,
      error: error instanceof Error ? error.message : 'Failed to find records',
    };
  }
}
