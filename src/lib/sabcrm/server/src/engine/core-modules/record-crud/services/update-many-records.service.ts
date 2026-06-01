import 'server-only';

// PORT-NOTE: Ported from twenty-server UpdateManyRecordsService.
// NestJS DI removed; exported as a plain async function.
// CommonUpdateManyQueryRunnerService replaced with Mongo updateMany.
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.

import { connectToDatabase } from '@/lib/mongodb';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { removeUndefinedFromRecord } from '../utils/remove-undefined-from-record.util';
import { getRecordDisplayName } from '../utils/get-record-display-name.util';
import { type UpdateManyRecordsParams } from '../types/update-many-records-params.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type FlatEntityMaps, type FlatFieldMetadata, type FlatObjectMetadata } from '../types/object-metadata-for-tool-schema.type';
import { buildCommonApiContext, type ObjectsPermissions } from './common-api-context-builder.service';

// PORT-NOTE: OBJECTS_BLOCKED_FROM_AUTOMATION inlined from twenty-shared/workflow.
const OBJECTS_BLOCKED_FROM_AUTOMATION = [
  'workflow', 'workflowVersion', 'workflowRun', 'workflowAutomatedTrigger',
  'workspaceMember', 'dashboard', 'message', 'messageThread',
  'messageChannelMessageAssociation', 'messageParticipant',
  'calendarEvent', 'calendarEventParticipant', 'calendarChannelEventAssociation',
] as const;

function canObjectBeManagedByAutomation({ nameSingular }: { nameSingular: string }): boolean {
  return !OBJECTS_BLOCKED_FROM_AUTOMATION.includes(
    nameSingular as (typeof OBJECTS_BLOCKED_FROM_AUTOMATION)[number],
  );
}

export type UpdateManyRecordsServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function updateManyCrmRecords(
  params: UpdateManyRecordsParams,
  deps: UpdateManyRecordsServiceDeps,
): Promise<ToolOutput> {
  const { objectName, filter, data, authContext } = params;

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

    if (!canObjectBeManagedByAutomation({ nameSingular: flatObjectMetadata.nameSingular })) {
      throw new RecordCrudException(
        'Failed to update: Object cannot be updated by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const cleanedData = removeUndefinedFromRecord(data as Record<string, unknown>);
    const now = new Date();
    const updatePayload = { ...cleanedData, updatedAt: now };

    const mongoFilter: Record<string, unknown> = {
      deletedAt: { $exists: false },
      ...filter,
    };

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    await collection.updateMany(mongoFilter, { $set: updatePayload });

    // Fetch updated documents to build the result
    const updatedRecords = await collection.find(mongoFilter).toArray();

    console.log(`[updateManyCrmRecords] Updated ${updatedRecords.length} records in ${objectName}`);

    return {
      success: true,
      message: `Updated ${updatedRecords.length} records in ${objectName}`,
      result: params.slimResponse
        ? updatedRecords.map((record) => ({ id: String(record.id ?? record._id) }))
        : updatedRecords,
      recordReferences: updatedRecords.map((record) => ({
        objectNameSingular: objectName,
        recordId: String(record.id ?? record._id),
        displayName: getRecordDisplayName(
          record as Record<string, unknown>,
          flatObjectMetadata,
          flatFieldMetadataMaps,
        ),
      })),
    };
  } catch (error) {
    if (error instanceof RecordCrudException) {
      return {
        success: false,
        message: `Failed to update records in ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[updateManyCrmRecords] Failed to update records: ${error}`);

    return {
      success: false,
      message: `Failed to update records in ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to update records',
    };
  }
}
