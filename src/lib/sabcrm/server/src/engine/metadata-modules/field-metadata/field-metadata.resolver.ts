"use server";

// PORT-NOTE: NestJS resolver decorators (MetadataResolver, UseGuards, etc.)
// removed. Exported functions are Next.js server actions with the same
// inputs/outputs as the original mutations/queries.

import {
  createOneField,
  createManyFields,
  updateOneField,
  deleteOneField,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/services/field-metadata.service";
import { fieldMetadataGraphqlApiExceptionHandler } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/field-metadata-graphql-api-exception-handler.util";
import { type RelationDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/relation.dto";

// ---------------------------------------------------------------------------
// createOneField
// ---------------------------------------------------------------------------

export type CreateOneFieldMetadataInput = {
  field: {
    objectMetadataId: string;
    type: string;
    name: string;
    label: string;
    description?: string | null;
    icon?: string | null;
    isNullable?: boolean | null;
    isUnique?: boolean;
    defaultValue?: unknown;
    options?: unknown;
    settings?: unknown;
    isLabelSyncedWithName?: boolean;
    isRemoteCreation?: boolean;
    relationCreationPayload?: unknown;
  };
};

export async function createOneFieldAction(
  input: CreateOneFieldMetadataInput,
  workspaceId: string,
): Promise<unknown> {
  try {
    return await createOneField({ createFieldInput: input.field, workspaceId });
  } catch (error) {
    return fieldMetadataGraphqlApiExceptionHandler(error as Error);
  }
}

// ---------------------------------------------------------------------------
// updateOneField
// ---------------------------------------------------------------------------

export type UpdateOneFieldMetadataInput = {
  id: string;
  update: {
    name?: string;
    label?: string;
    description?: string | null;
    icon?: string | null;
    isActive?: boolean;
    isNullable?: boolean | null;
    isUnique?: boolean;
    isLabelSyncedWithName?: boolean;
    defaultValue?: unknown;
    options?: unknown;
    settings?: unknown;
    morphRelationsUpdatePayload?: Array<Record<string, unknown>>;
  };
};

export async function updateOneFieldAction(
  input: UpdateOneFieldMetadataInput,
  workspaceId: string,
): Promise<unknown> {
  try {
    return await updateOneField({
      updateFieldInput: { ...input.update, id: input.id },
      workspaceId,
    });
  } catch (error) {
    fieldMetadataGraphqlApiExceptionHandler(error as Error);
  }
}

// ---------------------------------------------------------------------------
// deleteOneField
// ---------------------------------------------------------------------------

export type DeleteOneFieldInput = {
  id: string;
};

export async function deleteOneFieldAction(
  input: DeleteOneFieldInput,
  workspaceId: string,
): Promise<unknown> {
  if (!workspaceId) {
    throw new Error("Could not retrieve workspace ID");
  }

  try {
    return await deleteOneField({ deleteOneFieldInput: input, workspaceId });
  } catch (error) {
    fieldMetadataGraphqlApiExceptionHandler(error as Error);
  }
}

// ---------------------------------------------------------------------------
// Relation resolved fields (previously @ResolveField in the NestJS resolver)
// These are standalone async functions; dataloader-style batching is the
// caller's responsibility in the Next.js context.
// ---------------------------------------------------------------------------

export async function getFieldRelationAction(params: {
  fieldMetadataId: string;
  objectMetadataId: string;
  workspaceId: string;
}): Promise<RelationDTO | null> {
  // PORT-NOTE: The original implementation delegated to a DataLoader
  // (context.loaders.relationLoader). In the Next.js port this is a stub that
  // callers replace with the Mongo-backed relation lookup.
  // TODO: implement Mongo-backed relation resolution.
  void params;
  return null;
}

export async function getMorphFieldRelationsAction(params: {
  fieldMetadataId: string;
  objectMetadataId: string;
  workspaceId: string;
}): Promise<RelationDTO[] | null> {
  // PORT-NOTE: Same as above — stub for morphRelationLoader.
  // TODO: implement Mongo-backed morph-relation resolution.
  void params;
  return null;
}

// ---------------------------------------------------------------------------
// createManyFields helper (exposed so module-level callers can use it)
// ---------------------------------------------------------------------------

export async function createManyFieldsAction(
  inputs: Array<CreateOneFieldMetadataInput["field"]>,
  workspaceId: string,
): Promise<unknown[]> {
  try {
    return await createManyFields({ createFieldInputs: inputs, workspaceId });
  } catch (error) {
    return fieldMetadataGraphqlApiExceptionHandler(error as Error);
  }
}
