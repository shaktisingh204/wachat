import 'server-only';

// PORT-NOTE: Ported from twenty-server CreateManyRecordsService.
// NestJS DI removed; exported as a plain async function.
// CommonCreateManyQueryRunnerService is not yet ported — record insertion
// is delegated to the SabNode records.server layer (connectToDatabase).
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.

import { connectToDatabase } from '@/lib/mongodb';
import { FieldActorSource } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { removeUndefinedFromRecord } from '../utils/remove-undefined-from-record.util';
import { getRecordDisplayName } from '../utils/get-record-display-name.util';
import { type CreateManyRecordsParams } from '../types/create-many-records-params.type';
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

export type CreateManyRecordsServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function createManyRecords(
  params: CreateManyRecordsParams,
  deps: CreateManyRecordsServiceDeps,
): Promise<ToolOutput> {
  const { objectName, objectRecords, authContext } = params;

  try {
    const {
      selectedFields,
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
        'Failed to create: Object cannot be created by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const actorMetadata = params.createdBy ?? {
      source: FieldActorSource.WORKFLOW,
      name: 'Workflow',
    };

    const cleanedRecords = objectRecords.map((record) => ({
      ...removeUndefinedFromRecord(record as Record<string, unknown>),
      createdBy: actorMetadata,
    }));

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    const { insertedIds } = await collection.insertMany(cleanedRecords);
    const insertedIdValues = Object.values(insertedIds).map((id) => id.toString());

    const createdRecords = cleanedRecords.map((record, index) => ({
      ...record,
      id: insertedIdValues[index] ?? String(index),
    }));

    console.log(`[createManyRecords] Created ${createdRecords.length} records in ${objectName}`);

    return {
      success: true,
      message: `Created ${createdRecords.length} records in ${objectName}`,
      result: params.slimResponse
        ? createdRecords.map((record) => ({ id: record.id }))
        : createdRecords,
      recordReferences: createdRecords.map((record) => ({
        objectNameSingular: objectName,
        recordId: String(record.id),
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
        message: `Failed to create records in ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[createManyRecords] Failed to create records: ${error}`);

    return {
      success: false,
      message: `Failed to create records in ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to create records',
    };
  }
}
