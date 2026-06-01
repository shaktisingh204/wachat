// PORT-NOTE: FieldMetadataSettings, NumberDataType from twenty-shared/types
// are inlined. filesFieldSchema is stubbed since it depends on file-infra
// not yet ported; it falls back to z.array(z.record(z.string(), z.unknown())).

import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { z } from 'zod';

import {
  type FlatFieldMetadata,
  type ObjectMetadataForToolSchema,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import { type RestrictedFieldsPermissions } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/generate-create-many-record-input-schema.util';
import { RelationType } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/field-filters.zod-schema';

export enum NumberDataType {
  INT = 'INT',
  FLOAT = 'FLOAT',
  BIG_INT = 'BIG_INT',
}

// Stub for the files field schema (requires SabFiles integration).
const filesFieldSchema = z.array(
  z.object({
    fileId: z.string(),
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
  }),
);

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const isFieldAvailable = (field: FlatFieldMetadata, forResponse: boolean) => {
  if (forResponse) {
    return true;
  }
  switch (field.name) {
    case 'id':
    case 'createdAt':
    case 'updatedAt':
    case 'deletedAt':
    case 'createdBy':
    case 'updatedBy':
      return false;
    default:
      return true;
  }
};

const getFieldZodType = (field: FlatFieldMetadata): z.ZodTypeAny => {
  switch (field.type) {
    case FieldMetadataType.UUID:
      return z.string().uuid();

    case FieldMetadataType.TEXT:
      return z.string();

    case FieldMetadataType.DATE_TIME:
      return z.string().datetime();

    case FieldMetadataType.DATE:
      return z.string().date();

    case FieldMetadataType.NUMBER: {
      const settings = field.settings as {
        dataType?: NumberDataType;
        decimals?: number;
      } | undefined;

      if (
        settings?.dataType === NumberDataType.FLOAT ||
        (isDefined(settings?.decimals) && (settings?.decimals ?? 0) > 0)
      ) {
        return z.number();
      }

      return z.number().int();
    }

    case FieldMetadataType.NUMERIC:
    case FieldMetadataType.POSITION:
      return z.number();

    case FieldMetadataType.BOOLEAN:
      return z.boolean();

    case FieldMetadataType.RAW_JSON:
      return z.record(z.string(), z.unknown());

    default:
      return z.string();
  }
};

export const generateRecordPropertiesZodSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  forResponse = false,
  restrictedFields?: RestrictedFieldsPermissions,
): z.ZodObject<Record<string, z.ZodTypeAny>> => {
  const shape: Record<string, z.ZodTypeAny> = {};

  objectMetadata.fields.forEach((field) => {
    if (
      !isFieldAvailable(field, forResponse) ||
      field.type === FieldMetadataType.TS_VECTOR
    ) {
      return;
    }

    if (restrictedFields?.[field.id]?.canUpdate === false) {
      return;
    }

    const isRelationOrMorphRelation =
      field.type === FieldMetadataType.RELATION ||
      field.type === FieldMetadataType.MORPH_RELATION;

    if (
      isRelationOrMorphRelation &&
      field.settings?.relationType === RelationType.MANY_TO_ONE
    ) {
      const uuidSchema = z.string().uuid();

      shape[`${field.name}Id`] = field.isNullable
        ? uuidSchema.optional()
        : uuidSchema;

      return;
    }

    if (
      isRelationOrMorphRelation &&
      field.settings?.relationType === RelationType.ONE_TO_MANY
    ) {
      return;
    }

    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case FieldMetadataType.MULTI_SELECT: {
        const enumValues =
          field.options?.map((option: { value: string }) => option.value) || [];

        if (enumValues.length > 0) {
          fieldSchema = z.array(z.enum(enumValues as [string, ...string[]]));
        } else {
          fieldSchema = z.array(z.string());
        }
        break;
      }

      case FieldMetadataType.SELECT: {
        const enumValues =
          field.options?.map((option: { value: string }) => option.value) || [];

        if (enumValues.length > 0) {
          fieldSchema = z.enum(enumValues as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      }

      case FieldMetadataType.ARRAY:
        fieldSchema = z.array(z.string());
        break;

      case FieldMetadataType.RATING: {
        const enumValues =
          field.options?.map((option: { value: string }) => option.value) || [];

        if (enumValues.length > 0) {
          fieldSchema = z.enum(enumValues as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      }

      case FieldMetadataType.LINKS:
        fieldSchema = z.object({
          primaryLinkLabel: z.string().optional(),
          primaryLinkUrl: z.string().url().optional(),
          secondaryLinks: z
            .array(
              z.object({
                url: z.string().url(),
                label: z.string(),
              }),
            )
            .optional(),
        });
        break;

      case FieldMetadataType.CURRENCY:
        fieldSchema = z.object({
          amountMicros: z.number().optional(),
          currencyCode: z.string().optional(),
        });
        break;

      case FieldMetadataType.FULL_NAME:
        fieldSchema = z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        });
        break;

      case FieldMetadataType.ADDRESS:
        fieldSchema = z.object({
          addressStreet1: z.string().optional(),
          addressStreet2: z.string().optional(),
          addressCity: z.string().optional(),
          addressPostcode: z.string().optional(),
          addressState: z.string().optional(),
          addressCountry: z.string().optional(),
          addressLat: z.number().optional(),
          addressLng: z.number().optional(),
        });
        break;

      case FieldMetadataType.ACTOR:
        fieldSchema = z.object({
          source: z
            .enum([
              'EMAIL',
              'CALENDAR',
              'WORKFLOW',
              'AGENT',
              'API',
              'IMPORT',
              'MANUAL',
              'SYSTEM',
              'WEBHOOK',
            ])
            .optional(),
          ...(forResponse
            ? {
                workspaceMemberId: z.string().uuid().optional(),
                name: z.string().optional(),
              }
            : {}),
        });
        break;

      case FieldMetadataType.EMAILS:
        fieldSchema = z.object({
          primaryEmail: z.string().email().optional(),
          additionalEmails: z.array(z.string().email()).optional(),
        });
        break;

      case FieldMetadataType.PHONES:
        fieldSchema = z.object({
          primaryPhoneNumber: z.string().optional(),
          primaryPhoneCountryCode: z.string().optional(),
          primaryPhoneCallingCode: z.string().optional(),
          additionalPhones: z.array(z.string()).optional(),
        });
        break;

      case FieldMetadataType.RICH_TEXT:
        fieldSchema = z.object({
          markdown: z.string().optional(),
          blocknote: z.string().optional(),
        });
        break;

      case FieldMetadataType.FILES:
        fieldSchema = filesFieldSchema;
        break;

      default:
        fieldSchema = getFieldZodType(field);
        break;
    }

    if (field.name === 'position') {
      fieldSchema = z.union([
        z.number(),
        z.literal('first'),
        z.literal('last'),
      ]);

      fieldSchema = fieldSchema.describe(
        'Use "first" to insert at the top, "last" for the bottom, or a number for explicit ordering. Leave empty to place at the top (recommended).',
      );
    } else if (field.description) {
      fieldSchema = fieldSchema.describe(field.description);
    }

    if (field.isNullable) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.name] = fieldSchema;
  });

  return z.object(shape);
};
