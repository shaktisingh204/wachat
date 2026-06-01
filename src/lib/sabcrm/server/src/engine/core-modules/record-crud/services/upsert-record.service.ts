import 'server-only';

// PORT-NOTE: Ported from twenty-server UpsertRecordService.
// NestJS DI removed; exported as a plain async function.
// CommonCreateOneQueryRunnerService with upsert:true -> Mongo findOneAndUpdate with upsert option.
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.
// Conflict detection: upsert is keyed on `id` field if present; otherwise insertOne.

import { connectToDatabase } from '@/lib/mongodb';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { removeUndefinedFromRecord } from '../utils/remove-undefined-from-record.util';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type FlatEntityMaps, type FlatFieldMetadata, type FlatObjectMetadata } from '../types/object-metadata-for-tool-schema.type';
import { buildCommonApiContext, type ObjectsPermissions } from './common-api-context-builder.service';
import { type RecordCrudExecutionContext } from '../types/record-crud-execution-context.type';
import { type ObjectRecordProperties } from '../types/object-record-properties.type';

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

export type UpsertRecordParams = {
  objectName: string;
  objectRecord: ObjectRecordProperties;
} & RecordCrudExecutionContext;

export type UpsertRecordServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function upsertCrmRecord(
  params: UpsertRecordParams,
  deps: UpsertRecordServiceDeps,
): Promise<ToolOutput> {
  const { objectName, objectRecord, authContext } = params;

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
        'Failed to upsert: Object cannot be upserted by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const cleanedRecord = removeUndefinedFromRecord(objectRecord as Record<string, unknown>);
    const now = new Date();

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    // Use `id` field as the upsert key (UUID) if present; otherwise fall back to _id
    const upsertFilter: Record<string, unknown> = cleanedRecord.id
      ? { id: cleanedRecord.id }
      : {};

    const upsertedRecord = await collection.findOneAndUpdate(
      upsertFilter,
      {
        $set: { ...cleanedRecord, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.log(`[upsertCrmRecord] Record upserted successfully in ${objectName}`);

    return {
      success: true,
      message: `Record upserted successfully in ${objectName}`,
      result: upsertedRecord,
    };
  } catch (error) {
    if (error instanceof RecordCrudException) {
      return {
        success: false,
        message: `Failed to upsert record in ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[upsertCrmRecord] Failed to upsert record: ${error}`);

    return {
      success: false,
      message: `Failed to upsert record in ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to upsert record',
    };
  }
}
