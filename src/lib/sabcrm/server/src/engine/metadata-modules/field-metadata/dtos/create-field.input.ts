import { z } from 'zod';

import { FieldMetadataDTOSchema } from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/dtos/field-metadata.dto';

// PORT-NOTE: Ported from NestJS @InputType CreateFieldInput / CreateOneFieldMetadataInput.
// OmitType(FieldMetadataDTO, ['id','createdAt','updatedAt','standardOverrides','applicationId','morphId','universalIdentifier'])
// Additional fields: objectMetadataId, isRemoteCreation, relationCreationPayload, morphRelationsCreationPayload

export type RelationCreationPayload = Record<string, unknown>;

export const CreateFieldInputSchema = FieldMetadataDTOSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  standardOverrides: true,
  applicationId: true,
  morphId: true,
  universalIdentifier: true,
}).extend({
  objectMetadataId: z.string().uuid(),
  universalIdentifier: z.string().optional(),
  applicationId: z.string().uuid().optional(),
  isRemoteCreation: z.boolean().optional(),
  relationCreationPayload: z.record(z.unknown()).optional(),
  morphRelationsCreationPayload: z.array(z.record(z.unknown())).optional(),
});

export type CreateFieldInput = z.infer<typeof CreateFieldInputSchema>;

export const CreateOneFieldMetadataInputSchema = z.object({
  field: CreateFieldInputSchema,
});

export type CreateOneFieldMetadataInput = z.infer<
  typeof CreateOneFieldMetadataInputSchema
>;
