"use server";
import "server-only";

// PORT-NOTE: NestJS Injectable / TypeOrmQueryService dropped. Plain exported
// async functions backed by MongoDB. Dependency injection replaced with direct
// function calls. Business logic preserved from the original service.

import { type Filter, type FindOptions } from "mongodb";

import {
  getFieldMetadataCollection,
  type FieldMetadataDocument,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";
import {
  FieldMetadataException,
  FieldMetadataExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception";

// ---------------------------------------------------------------------------
// Shared input types (mirroring the DTOs used by the original service)
// ---------------------------------------------------------------------------

export type CreateFieldInput = {
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
  workspaceId?: string;
};

export type UpdateFieldInput = {
  id: string;
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
  workspaceId?: string;
};

export type DeleteOneFieldInput = {
  id: string;
};

// ---------------------------------------------------------------------------
// createOneField
// ---------------------------------------------------------------------------

export async function createOneField(params: {
  createFieldInput: Omit<CreateFieldInput, "workspaceId">;
  workspaceId: string;
  ownerFlatApplication?: { universalIdentifier: string };
}): Promise<FieldMetadataDocument> {
  const [created] = await createManyFields({
    workspaceId: params.workspaceId,
    createFieldInputs: [params.createFieldInput],
    ownerFlatApplication: params.ownerFlatApplication,
  });

  if (!created) {
    throw new FieldMetadataException(
      "Failed to create field metadata",
      FieldMetadataExceptionCode.INTERNAL_SERVER_ERROR,
    );
  }

  return created;
}

// ---------------------------------------------------------------------------
// createManyFields
// ---------------------------------------------------------------------------

export async function createManyFields(params: {
  createFieldInputs: Omit<CreateFieldInput, "workspaceId">[];
  workspaceId: string;
  ownerFlatApplication?: { universalIdentifier: string };
  isSystemBuild?: boolean;
}): Promise<FieldMetadataDocument[]> {
  const { createFieldInputs, workspaceId } = params;

  if (createFieldInputs.length === 0) {
    return [];
  }

  const col = await getFieldMetadataCollection();
  const now = new Date();

  const docs: FieldMetadataDocument[] = createFieldInputs.map((input) => {
    const { ObjectId } = require("mongodb");
    const id = new ObjectId().toHexString();
    return {
      _id: new (require("mongodb").ObjectId)(),
      id,
      universalIdentifier: id,
      applicationId: null,
      workspaceId,
      objectMetadataId: input.objectMetadataId,
      type: input.type,
      name: input.name,
      label: input.label,
      description: input.description ?? null,
      icon: input.icon ?? null,
      standardOverrides: null,
      options: input.options ?? null,
      settings: input.settings ?? null,
      defaultValue: input.defaultValue ?? null,
      isCustom: true,
      isActive: true,
      isSystem: false,
      isUIReadOnly: false,
      isNullable: input.isNullable ?? true,
      isUnique: input.isUnique ?? false,
      isLabelSyncedWithName: input.isLabelSyncedWithName ?? false,
      relationTargetFieldMetadataId: null as never,
      relationTargetObjectMetadataId: null as never,
      morphId: null as never,
      createdAt: now,
      updatedAt: now,
    } as FieldMetadataDocument;
  });

  await col.insertMany(docs);
  return docs;
}

// ---------------------------------------------------------------------------
// updateOneField
// ---------------------------------------------------------------------------

export async function updateOneField(params: {
  updateFieldInput: Omit<UpdateFieldInput, "workspaceId"> & { id: string };
  workspaceId: string;
  isSystemBuild?: boolean;
  ownerFlatApplication?: { universalIdentifier: string };
}): Promise<FieldMetadataDocument> {
  const { updateFieldInput, workspaceId } = params;
  const { id, workspaceId: _ws, ...rest } = updateFieldInput;

  const col = await getFieldMetadataCollection();

  const updateDoc: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      updateDoc[key] = value;
    }
  }

  const result = await col.findOneAndUpdate(
    { id, workspaceId } as Filter<FieldMetadataDocument>,
    { $set: updateDoc },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new FieldMetadataException(
      `Field metadata not found: ${id}`,
      FieldMetadataExceptionCode.FIELD_METADATA_NOT_FOUND,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// deleteOneField
// ---------------------------------------------------------------------------

export async function deleteOneField(params: {
  deleteOneFieldInput: DeleteOneFieldInput;
  workspaceId: string;
  isSystemBuild?: boolean;
  ownerFlatApplication?: { universalIdentifier: string };
}): Promise<FieldMetadataDocument> {
  const { deleteOneFieldInput, workspaceId } = params;
  const col = await getFieldMetadataCollection();

  const existing = await col.findOne({
    id: deleteOneFieldInput.id,
    workspaceId,
  } as Filter<FieldMetadataDocument>);

  if (!existing) {
    throw new FieldMetadataException(
      `Field metadata not found: ${deleteOneFieldInput.id}`,
      FieldMetadataExceptionCode.FIELD_METADATA_NOT_FOUND,
    );
  }

  if (existing.isSystem) {
    throw new FieldMetadataException(
      `System fields cannot be deleted: ${deleteOneFieldInput.id}`,
      FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED,
    );
  }

  await col.deleteOne({ _id: existing._id });
  return existing;
}

// ---------------------------------------------------------------------------
// findFieldMetadataWithinWorkspace — mirrors findOneWithinWorkspace
// ---------------------------------------------------------------------------

export async function findFieldMetadataWithinWorkspace(
  workspaceId: string,
  filter: Filter<FieldMetadataDocument>,
  options?: FindOptions<FieldMetadataDocument>,
): Promise<FieldMetadataDocument | null> {
  const col = await getFieldMetadataCollection();
  return col.findOne(
    { ...filter, workspaceId } as Filter<FieldMetadataDocument>,
    options,
  );
}

// ---------------------------------------------------------------------------
// query helper — mirrors the TypeOrmQueryService.query pattern used by tools
// ---------------------------------------------------------------------------

export async function queryFieldMetadata(params: {
  filter?: {
    workspaceId?: { eq: string };
    id?: { eq: string };
    objectMetadataId?: { eq: string };
  };
  paging?: { limit?: number };
}): Promise<FieldMetadataDocument[]> {
  const col = await getFieldMetadataCollection();
  const mongoFilter: Filter<FieldMetadataDocument> = {};

  if (params.filter?.workspaceId?.eq) {
    (mongoFilter as Record<string, unknown>).workspaceId =
      params.filter.workspaceId.eq;
  }
  if (params.filter?.id?.eq) {
    (mongoFilter as Record<string, unknown>).id = params.filter.id.eq;
  }
  if (params.filter?.objectMetadataId?.eq) {
    (mongoFilter as Record<string, unknown>).objectMetadataId =
      params.filter.objectMetadataId.eq;
  }

  return col
    .find(mongoFilter)
    .limit(params.paging?.limit ?? 100)
    .toArray();
}
