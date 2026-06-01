import { z } from 'zod';

// PORT-NOTE: Ported from NestJS options.input.ts.
// class-validator decorators replaced with zod schemas.
// IsValidGraphQLEnumName from twenty-shared/types replaced with a regex pattern check
// (GraphQL enum names must match /^[_A-Za-z][_0-9A-Za-z]*$/).

export type TagColor =
  | 'green'
  | 'turquoise'
  | 'sky'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'gray';

const GRAPHQL_ENUM_NAME_REGEX = /^[_A-Za-z][_0-9A-Za-z]*$/;

const tagColorSchema = z.enum([
  'green',
  'turquoise',
  'sky',
  'blue',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'gray',
]);

export const FieldMetadataDefaultOptionSchema = z.object({
  id: z.string().optional(),
  position: z.number(),
  label: z.string().min(1),
  value: z.string().min(1).regex(GRAPHQL_ENUM_NAME_REGEX, {
    message: 'value must be a valid GraphQL enum name',
  }),
});

export type FieldMetadataDefaultOption = z.infer<
  typeof FieldMetadataDefaultOptionSchema
>;

export const FieldMetadataComplexOptionSchema =
  FieldMetadataDefaultOptionSchema.extend({
    color: tagColorSchema,
  });

export type FieldMetadataComplexOption = z.infer<
  typeof FieldMetadataComplexOptionSchema
>;
