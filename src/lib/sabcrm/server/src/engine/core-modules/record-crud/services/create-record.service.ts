import 'server-only';

// PORT-NOTE: Ported from twenty-server CreateRecordService.
// NestJS DI removed; exported as a plain async function.
// CommonCreateOneQueryRunnerService replaced with direct Mongo insert via connectToDatabase.
// canObjectBeManagedByAutomation inlined from twenty-shared/workflow.

import { connectToDatabase } from '@/lib/mongodb';
import { FieldActorSource } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import {
  RecordCrudException,
  RecordCrudExceptionCode,
} from '../exceptions/record-crud.exception';
import { removeUndefinedFromRecord } from '../utils/remove-undefined-from-record.util';
import { getRecordDisplayName } from '../utils/get-record-display-name.util';
import { type CreateRecordParams } from '../types/create-record-params.type';
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

export type CreateRecordServiceDeps = {
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  objectsPermissions?: ObjectsPermissions;
};

export async function createRecord(
  params: CreateRecordParams,
  deps: CreateRecordServiceDeps,
): Promise<ToolOutput> {
  const { objectName, objectRecord, authContext } = params;

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
        'Failed to create: Object cannot be created by automation',
        RecordCrudExceptionCode.INVALID_REQUEST,
      );
    }

    const actorMetadata = params.createdBy ?? {
      source: FieldActorSource.WORKFLOW,
      name: 'Workflow',
    };

    const cleanedRecord = removeUndefinedFromRecord(objectRecord as Record<string, unknown>);
    const dataWithActor = { ...cleanedRecord, createdBy: actorMetadata };

    const { db } = await connectToDatabase();
    const collectionName = `sabcrm_${objectName.toLowerCase()}`;
    const collection = db.collection(collectionName);

    const result = await collection.insertOne(dataWithActor);
    const createdRecord = { ...dataWithActor, id: result.insertedId.toString() };

    console.log(`[createRecord] Record created successfully in ${objectName}`);

    return {
      success: true,
      message: `Record created successfully in ${objectName}`,
      result: params.slimResponse ? { id: createdRecord.id } : createdRecord,
      recordReferences: [
        {
          objectNameSingular: objectName,
          recordId: createdRecord.id,
          displayName: getRecordDisplayName(
            createdRecord as Record<string, unknown>,
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
        message: `Failed to create record in ${objectName}`,
        error: error.message,
      };
    }

    console.error(`[createRecord] Failed to create record: ${error}`);

    return {
      success: false,
      message: `Failed to create record in ${objectName}`,
      error: error instanceof Error ? error.message : 'Failed to create record',
    };
  }
}
