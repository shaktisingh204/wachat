import { z } from 'zod';

import { type FieldMetadataStandardOverridesProperty } from 'src/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/constants/field-metadata-standard-overrides-properties.constant';

// PORT-NOTE: Ported from NestJS @ObjectType FieldStandardOverridesDTO.
// APP_LOCALES from twenty-shared/translations used for translations key; kept as string record.

export type FieldStandardOverridesDTO = Partial<
  Record<FieldMetadataStandardOverridesProperty, string | null>
> & {
  label?: string | null;
  description?: string | null;
  icon?: string | null;
  translations?: Partial<
    Record<
      string,
      {
        label?: string | null;
        description?: string | null;
      }
    >
  > | null;
};

export const FieldStandardOverridesDTOSchema = z.object({
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  translations: z
    .record(
      z.object({
        label: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});
