import { z } from 'zod';

// PORT-NOTE: Ported from NestJS @ObjectType FieldMetadataDTO.
// FieldMetadataType is imported from twenty-shared/types — mapped to the ported shared type.
// @ptc-org/nestjs-query-graphql decorators (FilterableField, IDField, QueryOptions, Authorize, Relation) are dropped.
// registerEnumType → zod enum.
// Generic <T extends FieldMetadataType> is preserved on the TypeScript type level.

import { type FieldMetadataType } from 'src/lib/sabcrm/shared/src/types/FieldMetadataType';
import {
  FieldStandardOverridesDTOSchema,
  type FieldStandardOverridesDTO,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/field-standard-overrides.dto';
import {
  type FieldMetadataDefaultOption,
  type FieldMetadataComplexOption,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/options.input';

export type {
  FieldMetadataDefaultOption,
  FieldMetadataComplexOption,
};

// Re-export FieldMetadataType for convenience
export type { FieldMetadataType };

export type FieldMetadataDTO<T extends FieldMetadataType = FieldMetadataType> = {
  id: string;
  universalIdentifier: string;
  type: T;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  standardOverrides?: FieldStandardOverridesDTO;
  isCustom?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  isUIReadOnly?: boolean;
  isNullable?: boolean;
  isUnique?: boolean;
  defaultValue?: unknown;
  options?: unknown;
  settings?: unknown;
  /** Hidden from clients */
  workspaceId: string;
  objectMetadataId: string;
  isLabelSyncedWithName?: boolean;
  morphId?: string;
  createdAt: Date;
  updatedAt: Date;
  applicationId: string;
};

export const FieldMetadataDTOSchema = z.object({
  id: z.string().uuid(),
  universalIdentifier: z.string().min(1),
  type: z.string() as z.ZodType<FieldMetadataType>,
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  standardOverrides: FieldStandardOverridesDTOSchema.optional(),
  isCustom: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  isUIReadOnly: z.boolean().optional(),
  isNullable: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  options: z.unknown().optional(),
  settings: z.unknown().optional(),
  workspaceId: z.string(),
  objectMetadataId: z.string().uuid(),
  isLabelSyncedWithName: z.boolean().optional(),
  morphId: z.string().uuid().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  applicationId: z.string().uuid(),
});
