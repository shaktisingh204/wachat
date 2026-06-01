import 'server-only';

// PORT-NOTE: Ported from twenty-server UpdateRecordService.
// NestJS DI removed; exported as a plain async function.
// CommonUpdateOneQueryRunnerService replaced with Mongo findOneAndUpdate.
// isDefined/isValidUuid inlined from twenty-shared/utils.
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { removeUndefinedFromRecord } from '../utils/remove-undefined-from-record.util';
import { getRecordDisplayName } from '../utils/get-record-display-name.util';
import { type UpdateRecordParams } from '../types/update-record-params.type';
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export type UpdateRecordServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function updateCrmRecord(
  params: UpdateRecordParams,
  deps: UpdateRecordServiceDeps,
): Promise<ToolOutput> {
  const {
    objectName,
    objectRecordId,
    objectRecord,
    fieldsToUpdate,
    authContext,
  } = params;

  if (!objectRecordId || !isValidUuid(objectRecordId)) {
    return {
      success: false,
      message: 'Failed to update: Object record ID must be a valid UUID',
      error: 'Invalid object record ID',
    };
  }

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

    const fieldsToUpdateArray = fieldsToUpdate ?? Object.keys(objectRecord);

    if (fieldsToUpdateArray.length === 0) {
      return {
        success: true,
        message: 'No fields to update',
        result: undefined,
      };
    }

    // Filter objectRecord to only include fieldsToUpdate
    const filteredObjectRecord = Object.keys(objectRecord).reduce<
      Record<string, unknown>
    >((acc, key) => {
      if (fieldsToUpdateArray.includes(key)) {
        return { ...acc, [key]: (objectRecord as Record<string, unknown>)[key] };
      }
      return acc;
    }, {});

    const cleanedRecord = removeUndefinedFromRecord(filteredObjectRecord);
    const now = new Date();
    const updatePayload = { ...cleanedRecord, updatedAt: now };

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    let filter: Record<string, unknown>;
    try {
      filter = { _id: new ObjectId(objectRecordId) };
    } catch {
      filter = { id: objectRecordId };
    }

    const updatedRecord = await collection.findOneAndUpdate(
      filter,
      { $set: updatePayload },
      { returnDocument: 'after' },
    );

    if (!updatedRecord) {
      throw new RecordCrudException(
        `Record ${objectRecordId} not found in ${objectName}`,
        RecordCrudExceptionCode.RECORD_NOT_FOUND,
      );
    }

    console.log(`[updateCrmRecord] Record updated successfully in ${objectName}`);

    return {
      success: true,
      message: `Record updated successfully in ${objectName}`,
      result: params.slimResponse ? { id: objectRecordId } : updatedRecord,
      recordReferences: [
        {
          objectNameSingular: objectName,
          recordId: objectRecordId,
          displayName: getRecordDisplayName(
            updatedRecord as Record<string, unknown>,
            flatObjectMetadata,
            flatFieldMetadataMaps,
          ),
        },
      ],
    };
  } catch (error) {
    if (error instanceof RecordCrudException) {
      return {
        success: false,
        message: `Failed to update record in ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[updateCrmRecord] Failed to update record: ${error}`);

    return {
      success: false,
      message: `Failed to update record in ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to update record',
    };
  }
}
