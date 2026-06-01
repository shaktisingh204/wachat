// PORT-NOTE: NestJS @InputType / class-validator decorators removed; plain TS
// types + zod schemas for validation in Next.js server actions.

import { z } from 'zod';

// Subset of UpdateFieldInput from the source (OmitType+PartialType of
// FieldMetadataDTO minus immutable fields).
export type UpdateFieldInput = {
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
  // Hidden fields kept for type completeness (not user-settable via API)
  id?: string;
  workspaceId?: string;
  // morphRelationsUpdatePayload allows updating multiple morph-relation targets
  morphRelationsUpdatePayload?: Array<{
    targetObjectMetadataId: string;
    targetFieldMetadataId?: string;
    [key: string]: unknown;
  }>;
};

export const UpdateFieldInputSchema: z.ZodType<UpdateFieldInput> = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isNullable: z.boolean().nullable().optional(),
  isUnique: z.boolean().optional(),
  isLabelSyncedWithName: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.unknown().optional(),
  settings: z.unknown().optional(),
  id: z.string().optional(),
  workspaceId: z.string().optional(),
  morphRelationsUpdatePayload: z
    .array(
      z.object({
        targetObjectMetadataId: z.string().uuid(),
        targetFieldMetadataId: z.string().uuid().optional(),
      }).passthrough(),
    )
    .optional(),
});

export type UpdateOneFieldMetadataInput = {
  /** The id of the field to update */
  id: string;
  /** The update payload */
  update: UpdateFieldInput;
};

export const UpdateOneFieldMetadataInputSchema: z.ZodType<UpdateOneFieldMetadataInput> =
  z.object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
    update: UpdateFieldInputSchema,
  });
