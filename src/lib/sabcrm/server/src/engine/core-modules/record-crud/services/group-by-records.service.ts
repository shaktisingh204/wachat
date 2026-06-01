import 'server-only';

// PORT-NOTE: Ported from twenty-server GroupByRecordsService.
// NestJS DI removed; exported as a plain async function.
// CommonGroupByQueryRunnerService / GroupByArgProcessorService replaced with
// native Mongo $group aggregation pipeline.
// AggregateOperations inlined from ported shared types.
// QUERY_MAX_RECORDS inlined (original: 1000).
//
// resolveToolAggregateFieldKeyOrThrow logic is preserved inline:
// maps (aggregateOperation, aggregateFieldName) -> Mongo accumulator expression.

import { connectToDatabase } from '@/lib/mongodb';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { type GroupByRecordsParams, type ObjectRecordGroupByEntry } from '../types/group-by-records-params.type';
import { type GroupByRecordsResult } from '../types/group-by-records-result.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type FlatEntityMaps, type FlatFieldMetadata, type FlatObjectMetadata } from '../types/object-metadata-for-tool-schema.type';
import { buildCommonApiContext, type ObjectsPermissions } from './common-api-context-builder.service';
import { AggregateOperations } from '@/lib/sabcrm/shared/src/types/AggregateOperations';

const QUERY_MAX_RECORDS = 1000;

// PORT-NOTE: OBJECTS_BLOCKED_FROM_AUTOMATION inlined from twenty-shared/workflow.
const OBJECTS_BLOCKED_FROM_AUTOMATION = [
  'workflow', 'workflowVersion', 'workflowRun', 'workflowAutomatedTrigger',
  'workspaceMember', 'dashboard', 'message', 'messageThread',
  'messageChannelMessageAssociation', 'messageParticipant',
  'calendarEvent', 'calendarEventParticipant', 'calendarChannelEventAssociation',
] as const;

export type GroupByRecordsServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

function getDimensionLabelFromGroupByEntry(entry: ObjectRecordGroupByEntry): string {
  const fieldEntries = Object.entries(entry);
  if (fieldEntries.length === 0) return '';

  const [fieldName, fieldDefinition] = fieldEntries[0];
  if (fieldDefinition === true) return fieldName;
  if (typeof fieldDefinition !== 'object' || fieldDefinition === null) return fieldName;

  const nestedEntries = Object.entries(fieldDefinition as Record<string, unknown>);
  if (nestedEntries.length !== 1) return fieldName;

  const [nestedFieldName, nestedFieldDefinition] = nestedEntries[0];
  if (nestedFieldDefinition !== true) return fieldName;
  if (nestedFieldName === 'id' && fieldName.endsWith('Id')) return fieldName;

  return `${fieldName}.${nestedFieldName}`;
}

function buildGroupId(groupBy: ObjectRecordGroupByEntry[]): Record<string, unknown> {
  const groupId: Record<string, unknown> = {};

  for (const entry of groupBy) {
    for (const [fieldName, fieldDefinition] of Object.entries(entry)) {
      if (fieldDefinition === true) {
        groupId[fieldName] = `$${fieldName}`;
      } else if (typeof fieldDefinition === 'object' && fieldDefinition !== null) {
        for (const nestedField of Object.keys(fieldDefinition as Record<string, unknown>)) {
          const key = `${fieldName}_${nestedField}`;
          groupId[key] = `$${fieldName}.${nestedField}`;
        }
      }
    }
  }

  return groupId;
}

function buildMongoAccumulator(
  aggregateOperation: keyof typeof AggregateOperations,
  aggregateFieldName?: string,
): Record<string, unknown> {
  switch (aggregateOperation) {
    case 'COUNT':
      return { $sum: 1 };
    case 'COUNT_EMPTY':
      return {
        $sum: {
          $cond: [
            { $or: [{ $eq: [aggregateFieldName ? `$${aggregateFieldName}` : null, null] }, { $eq: [aggregateFieldName ? `$${aggregateFieldName}` : '', ''] }] },
            1, 0,
          ],
        },
      };
    case 'COUNT_NOT_EMPTY':
      return {
        $sum: {
          $cond: [
            { $and: [{ $ne: [aggregateFieldName ? `$${aggregateFieldName}` : null, null] }, { $ne: [aggregateFieldName ? `$${aggregateFieldName}` : '', ''] }] },
            1, 0,
          ],
        },
      };
    case 'SUM':
      return { $sum: aggregateFieldName ? `$${aggregateFieldName}` : 1 };
    case 'AVG':
      return { $avg: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'MIN':
      return { $min: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'MAX':
      return { $max: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'COUNT_UNIQUE_VALUES':
      return { $addToSet: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'EARLIEST_DATE':
      return { $min: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'LATEST_DATE':
      return { $max: aggregateFieldName ? `$${aggregateFieldName}` : null };
    case 'PERCENTAGE_EMPTY':
    case 'PERCENTAGE_NOT_EMPTY':
      // PORT-NOTE: percentage accumulators require post-processing; return COUNT for now
      return { $sum: 1 };
    default:
      return { $sum: 1 };
  }
}

export async function groupByCrmRecords(
  params: GroupByRecordsParams,
  deps: GroupByRecordsServiceDeps,
): Promise<ToolOutput<GroupByRecordsResult>> {
  const {
    objectName,
    groupBy,
    aggregateOperation = 'COUNT',
    aggregateFieldName,
    limit,
    orderBy = 'DESC',
    filter,
    authContext,
  } = params;

  try {
    const { flatObjectMetadata } = await buildCommonApiContext({
      authContext,
      objectName,
      flatObjectMetadataMaps: deps.flatObjectMetadataMaps,
      flatFieldMetadataMaps: deps.flatFieldMetadataMaps,
      objectsPermissions: deps.objectsPermissions,
    });

    if (
      OBJECTS_BLOCKED_FROM_AUTOMATION.includes(
        flatObjectMetadata.nameSingular as (typeof OBJECTS_BLOCKED_FROM_AUTOMATION)[number],
      )
    ) {
      throw new RecordCrudException(
        'Failed to group: Object cannot be queried by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    const clampedLimit = limit ? Math.min(limit, QUERY_MAX_RECORDS) : QUERY_MAX_RECORDS;

    const mongoFilter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...(filter ?? {}),
    };

    const groupId = buildGroupId(groupBy);
    const accumulator = buildMongoAccumulator(aggregateOperation, aggregateFieldName);

    const pipeline: object[] = [
      { $match: mongoFilter },
      {
        $group: {
          _id: groupId,
          aggregateValue: accumulator,
        },
      },
      { $sort: { aggregateValue: orderBy === 'ASC' ? 1 : -1 } },
      { $limit: clampedLimit },
    ];

    const rawResults = await collection.aggregate(pipeline).toArray();

    const dimensionLabels = groupBy.map((entry) =>
      getDimensionLabelFromGroupByEntry(entry),
    );

    const groups = rawResults.map((item) => {
      const dimensions: string[] = [];
      if (item._id && typeof item._id === 'object') {
        for (const val of Object.values(item._id as Record<string, unknown>)) {
          dimensions.push(val === null || val === undefined ? 'null' : String(val));
        }
      } else {
        dimensions.push(item._id === null ? 'null' : String(item._id));
      }

      let value: string | number | null = item.aggregateValue;
      if (aggregateOperation === 'COUNT_UNIQUE_VALUES' && Array.isArray(value)) {
        value = (value as unknown[]).length;
      }

      return { dimensions, value };
    });

    console.log(
      `[groupByCrmRecords] Grouped ${objectName} by ${dimensionLabels.join(', ')}: ${groups.length} groups`,
    );

    return {
      success: true,
      message: `Grouped ${objectName} by ${dimensionLabels.join(', ')}: ${groups.length} groups`,
      result: {
        groups,
        dimensionLabels,
        aggregation: aggregateOperation,
        groupCount: groups.length,
      },
    };
  } catch (error) {
    if (error instanceof RecordCrudException) {
      return {
        success: false,
        message: `Failed to group ${objectName} records`,
        error: error.message,
      };
    }

    console.error(`[groupByCrmRecords] Failed to group records: ${error}`);

    return {
      success: false,
      message: `Failed to group ${objectName} records`,
      error: error instanceof Error ? error.message : 'Failed to group records',
    };
  }
}
