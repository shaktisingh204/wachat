import 'server-only';

// PORT-NOTE: Ported from twenty-server DeleteRecordService.
// NestJS DI removed; exported as a plain async function.
// CommonDeleteOneQueryRunnerService -> soft delete sets deletedAt.
// CommonDestroyOneQueryRunnerService -> hard delete removes doc.
// isDefined/isValidUuid inlined from twenty-shared/utils.
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { type DeleteRecordParams } from '../types/delete-record-params.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type FlatEntityMaps, type FlatObjectMetadata } from '../types/object-metadata-for-tool-schema.type';
import { type FlatFieldMetadata } from '../types/object-metadata-for-tool-schema.type';
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

// PORT-NOTE: isValidUuid inlined from twenty-shared/utils
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export type DeleteRecordServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function deleteCrmRecord(
  params: DeleteRecordParams,
  deps: DeleteRecordServiceDeps,
): Promise<ToolOutput> {
  const { objectName, objectRecordId, authContext, soft = true } = params;

  if (!objectRecordId || !isValidUuid(objectRecordId)) {
    return {
      success: false,
      message: 'Failed to delete: Object record ID must be a valid UUID',
      error: 'Invalid object record ID',
    };
  }

  try {
    const { flatObjectMetadata } = await buildCommonApiContext({
      authContext,
      objectName,
      flatObjectMetadataMaps: deps.flatObjectMetadataMaps,
      flatFieldMetadataMaps: deps.flatFieldMetadataMaps,
      objectsPermissions: deps.objectsPermissions,
    });

    if (!canObjectBeManagedByAutomation({ nameSingular: flatObjectMetadata.nameSingular })) {
      throw new RecordCrudException(
        'Failed to delete: Object cannot be deleted by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    let filter: Record<string, unknown>;
    try {
      filter = { _id: new ObjectId(objectRecordId) };
    } catch {
      // If objectRecordId is a UUID string not castable to ObjectId, use id field
      filter = { id: objectRecordId };
    }

    if (soft) {
      const now = new Date();
      const updateResult = await collection.findOneAndUpdate(
        filter,
        { $set: { deletedAt: now, updatedAt: now } },
        { returnDocument: 'after' },
      );

      if (!updateResult) {
        throw new RecordCrudException(
          `Record ${objectRecordId} not found in ${objectName}`,
          RecordCrudExceptionCode.RECORD_NOT_FOUND,
        );
      }

      console.log(`[deleteCrmRecord] Record soft deleted successfully from ${objectName}`);

      return {
        success: true,
        message: `Record soft deleted successfully from ${objectName}`,
        result: updateResult,
      };
    } else {
      const deleteResult = await collection.findOneAndDelete(filter);

      if (!deleteResult) {
        throw new RecordCrudException(
          `Record ${objectRecordId} not found in ${objectName}`,
          RecordCrudExceptionCode.RECORD_NOT_FOUND,
        );
      }

      console.log(`[deleteCrmRecord] Record permanently deleted successfully from ${objectName}`);

      return {
        success: true,
        message: `Record permanently deleted successfully from ${objectName}`,
        result: deleteResult,
      };
    }
  } catch (error) {
    if (error instanceof RecordCrudException) {
      return {
        success: false,
        message: `Failed to delete record from ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[deleteCrmRecord] Failed to delete record: ${error}`);

    return {
      success: false,
      message: `Failed to delete record from ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to delete record',
    };
  }
}
