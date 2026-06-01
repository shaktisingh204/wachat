'use server';

import 'server-only';

// PORT-NOTE: Ported from NestJS REST @Controller('rest/metadata/fields').
// In Next.js this would map to an App Router Route Handler at
//   app/api/rest/metadata/fields/route.ts   (GET / POST)
//   app/api/rest/metadata/fields/[id]/route.ts  (GET / PATCH / PUT / DELETE)
//
// This file exports plain server functions that mirror each HTTP handler.
// Auth guards (@UseGuards JwtAuthGuard, WorkspaceAuthGuard, SettingsPermissionGuard)
// → caller must enforce authentication and check PermissionFlagType.DATA_MODEL before invoking.
//
// TypeORM + FieldMetadataRepository → Mongo collection sabcrm_field_metadata.
// FeatureFlagService.isFeatureEnabled(IS_REST_METADATA_API_NEW_FORMAT_DIRECT) → toggles response shape.

import { connectToDatabase } from '@/lib/mongodb';
import { type FieldMetadataDTO } from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/field-metadata.dto';
import { type CreateFieldInput } from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/create-field.input';

const COLLECTION = 'sabcrm_field_metadata';

async function getFieldCollection() {
  const { db } = await connectToDatabase();
  return db.collection<FieldMetadataDTO & { workspaceId: string }>(COLLECTION);
}

export type RestCursorPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
};

export type FieldMetadataListResult = {
  data: FieldMetadataDTO[];
  pageInfo: RestCursorPageInfo;
  totalCount: number;
};

/** GET /rest/metadata/fields */
export async function findManyFields({
  workspaceId,
  limit = 10,
  startingAfter,
  endingBefore,
}: {
  workspaceId: string;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
}): Promise<FieldMetadataListResult> {
  const col = await getFieldCollection();

  const filter: Record<string, unknown> = { workspaceId };
  if (startingAfter) {
    filter['id'] = { $gt: startingAfter };
  } else if (endingBefore) {
    filter['id'] = { $lt: endingBefore };
  }

  const [items, totalCount] = await Promise.all([
    col.find(filter).limit(limit + 1).sort({ id: 1 }).toArray(),
    col.countDocuments({ workspaceId }),
  ]);

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop();

  return {
    data: items as unknown as FieldMetadataDTO[],
    pageInfo: {
      hasNextPage,
      hasPreviousPage: Boolean(startingAfter || endingBefore),
      startCursor: items[0]?.id,
      endCursor: items[items.length - 1]?.id,
    },
    totalCount,
  };
}

/** GET /rest/metadata/fields/:id */
export async function findOneField({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<FieldMetadataDTO | null> {
  const col = await getFieldCollection();
  return col.findOne({ id, workspaceId }) as Promise<FieldMetadataDTO | null>;
}

/** POST /rest/metadata/fields */
export async function createOneField({
  input,
  workspaceId,
}: {
  input: CreateFieldInput;
  workspaceId: string;
}): Promise<FieldMetadataDTO> {
  const col = await getFieldCollection();
  const now = new Date();
  const doc = {
    ...input,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  } as FieldMetadataDTO & { workspaceId: string };
  await col.insertOne(doc as FieldMetadataDTO & { workspaceId: string; _id?: unknown });
  return doc as FieldMetadataDTO;
}

/** PATCH|PUT /rest/metadata/fields/:id */
export async function updateOneField({
  id,
  workspaceId,
  update,
}: {
  id: string;
  workspaceId: string;
  update: Partial<FieldMetadataDTO>;
}): Promise<FieldMetadataDTO | null> {
  const col = await getFieldCollection();
  await col.updateOne({ id, workspaceId }, { $set: { ...update, updatedAt: new Date() } });
  return col.findOne({ id, workspaceId }) as Promise<FieldMetadataDTO | null>;
}

/** DELETE /rest/metadata/fields/:id */
export async function deleteOneField({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<FieldMetadataDTO | null> {
  const col = await getFieldCollection();
  const field = await col.findOne({ id, workspaceId });
  if (field) {
    await col.deleteOne({ id, workspaceId });
  }
  return field as FieldMetadataDTO | null;
}
