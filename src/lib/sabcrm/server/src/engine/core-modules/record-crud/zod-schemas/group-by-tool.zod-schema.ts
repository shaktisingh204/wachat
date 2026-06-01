// PORT-NOTE: Several utilities (getAvailableAggregationsFromObjectFields,
// isCompositeFieldMetadataType, getGroupableSubFieldsForCompositeType,
// isFlatFieldMetadataSupportedInGroupBy, isFieldMetadataEntityOfType,
// isFieldMetadataDateKind) are inlined/stubbed here since their source modules
// are GraphQL/TypeORM specific with no direct Mongo equivalent.

import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { z } from 'zod';

import { type ObjectMetadataForToolSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import { type RestrictedFieldsPermissions } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/generate-create-many-record-input-schema.util';
import {
  AggregateOperations,
  type AggregationField,
  resolveAggregateFieldKey,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/resolve-aggregate-field-key.util';
import { generateRecordFilterSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/record-filter.zod-schema';
import { RelationType } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/field-filters.zod-schema';

export enum ObjectRecordGroupByDateGranularity {
  NONE = 'NONE',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export enum FirstDayOfTheWeek {
  MONDAY = 'MONDAY',
  SUNDAY = 'SUNDAY',
  SATURDAY = 'SATURDAY',
}

// Determines if a field type is a date kind
const isFieldMetadataDateKind = (type: string): boolean =>
  type === FieldMetadataType.DATE || type === FieldMetadataType.DATE_TIME;

// Composite field types that can be group-by targets
const COMPOSITE_FIELD_TYPES: Set<string> = new Set([
  FieldMetadataType.FULL_NAME,
  FieldMetadataType.EMAILS,
  FieldMetadataType.PHONES,
  FieldMetadataType.LINKS,
  FieldMetadataType.ADDRESS,
  FieldMetadataType.CURRENCY,
]);

const isCompositeFieldMetadataType = (type: string): boolean =>
  COMPOSITE_FIELD_TYPES.has(type);

const COMPOSITE_GROUP_BY_SUB_FIELDS: Partial<
  Record<FieldMetadataType, string[]>
> = {
  [FieldMetadataType.FULL_NAME]: ['firstName', 'lastName'],
  [FieldMetadataType.EMAILS]: ['primaryEmail'],
  [FieldMetadataType.PHONES]: ['primaryPhoneNumber'],
  [FieldMetadataType.LINKS]: ['primaryLinkUrl'],
  [FieldMetadataType.ADDRESS]: ['addressCity', 'addressCountry'],
  [FieldMetadataType.CURRENCY]: ['currencyCode'],
};

const getGroupableSubFieldsForCompositeType = (
  type: string,
): string[] | null => {
  return (
    COMPOSITE_GROUP_BY_SUB_FIELDS[type as FieldMetadataType] ?? null
  );
};

// Fields excluded from group-by
const NON_GROUPABLE_TYPES: Set<string> = new Set([
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.TS_VECTOR,
  FieldMetadataType.FILES,
  FieldMetadataType.ACTOR,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.ARRAY,
]);

const isFlatFieldMetadataSupportedInGroupBy = (field: {
  type: string;
  name: string;
}): boolean => {
  if (NON_GROUPABLE_TYPES.has(field.type)) {
    return false;
  }
  if (
    field.name === 'createdBy' ||
    field.name === 'updatedBy' ||
    field.name === 'deletedAt'
  ) {
    return false;
  }
  return true;
};

// Builds available aggregations from fields — simplified version.
const getAvailableAggregationsFromObjectFields = (
  fields: Array<{ id: string; name: string; type: string }>,
): Record<string, AggregationField> => {
  const result: Record<string, AggregationField> = {};

  result['count'] = {
    aggregateOperation: AggregateOperations.COUNT,
    fromField: 'id',
  };

  for (const field of fields) {
    const isNumeric =
      field.type === FieldMetadataType.NUMBER ||
      field.type === FieldMetadataType.NUMERIC;
    if (isNumeric) {
      result[`sum${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`] =
        {
          aggregateOperation: AggregateOperations.SUM,
          fromField: field.name,
        };
      result[
        `average${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`
      ] = {
        aggregateOperation: AggregateOperations.AVERAGE,
        fromField: field.name,
      };
      result[`min${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`] =
        {
          aggregateOperation: AggregateOperations.MIN,
          fromField: field.name,
        };
      result[`max${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`] =
        {
          aggregateOperation: AggregateOperations.MAX,
          fromField: field.name,
        };
    }
  }

  return result;
};

const dateGranularityValues = Object.values(
  ObjectRecordGroupByDateGranularity,
).filter((v) => v !== ObjectRecordGroupByDateGranularity.NONE) as [
  string,
  ...string[],
];

const dateGroupBySchema = z
  .object({
    granularity: z
      .enum(dateGranularityValues)
      .default(ObjectRecordGroupByDateGranularity.MONTH)
      .describe('Date grouping granularity. Default: MONTH.'),
    weekStartDay: z
      .nativeEnum(FirstDayOfTheWeek)
      .optional()
      .describe(
        'First day of week (MONDAY, SUNDAY, SATURDAY). Only used when granularity is WEEK.',
      ),
    timeZone: z
      .string()
      .default('UTC')
      .describe(
        'IANA timezone for date groupings (e.g. "America/New_York"). Default: UTC.',
      ),
  })
  .strict()
  .describe('Date field grouping configuration');

const buildGroupByEntriesAndDescriptions = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
): {
  groupByEntries: z.ZodTypeAny[];
  fieldNameDescriptions: string[];
} => {
  const groupByEntries: z.ZodTypeAny[] = [];
  const fieldNameDescriptions: string[] = [];

  for (const field of objectMetadata.fields) {
    if (restrictedFields?.[field.id]?.canRead === false) {
      continue;
    }

    if (!isFlatFieldMetadataSupportedInGroupBy(field)) {
      continue;
    }

    const isRelationField = field.type === FieldMetadataType.RELATION;
    const isMorphRelationField = field.type === FieldMetadataType.MORPH_RELATION;

    if (isRelationField || isMorphRelationField) {
      if (field.settings?.relationType === RelationType.MANY_TO_ONE) {
        const relationFieldName = `${field.name}Id`;

        groupByEntries.push(
          z.object({ [relationFieldName]: z.literal(true) }).strict(),
        );
        fieldNameDescriptions.push(relationFieldName);
      }

      continue;
    }

    if (isFieldMetadataDateKind(field.type)) {
      groupByEntries.push(
        z.object({ [field.name]: dateGroupBySchema }).strict(),
      );
      fieldNameDescriptions.push(`${field.name} (date)`);
      continue;
    }

    if (isCompositeFieldMetadataType(field.type)) {
      const subFields = getGroupableSubFieldsForCompositeType(field.type);

      if (subFields) {
        for (const subField of subFields) {
          groupByEntries.push(
            z
              .object({
                [field.name]: z
                  .object({ [subField]: z.literal(true) })
                  .strict(),
              })
              .strict(),
          );
          fieldNameDescriptions.push(`${field.name}.${subField}`);
        }
      }

      continue;
    }

    groupByEntries.push(z.object({ [field.name]: z.literal(true) }).strict());
    fieldNameDescriptions.push(field.name);
  }

  return { groupByEntries, fieldNameDescriptions };
};

export const hasGroupByToolInputSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
): boolean => {
  return (
    buildGroupByEntriesAndDescriptions(objectMetadata, restrictedFields)
      .groupByEntries.length > 0
  );
};

export const generateGroupByToolInputSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
): z.ZodTypeAny | null => {
  const { groupByEntries, fieldNameDescriptions } =
    buildGroupByEntriesAndDescriptions(objectMetadata, restrictedFields);

  if (groupByEntries.length === 0) {
    return null;
  }

  const groupByEntrySchema =
    groupByEntries.length === 1
      ? groupByEntries[0]
      : z.union(
          groupByEntries as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
        );

  const { filterShape, filterSchema } = generateRecordFilterSchema(
    objectMetadata,
    restrictedFields,
  );

  const availableAggregations = getAvailableAggregationsFromObjectFields(
    objectMetadata.fields.filter(
      (field) => restrictedFields?.[field.id]?.canRead !== false,
    ),
  );

  const availableAggregateFieldNames = Array.from(
    new Set(
      Object.values(availableAggregations)
        .filter(
          (aggregation) =>
            aggregation.aggregateOperation !== AggregateOperations.COUNT,
        )
        .map((aggregation) =>
          aggregation.subFieldForNumericOperation
            ? `${aggregation.fromField}.${aggregation.subFieldForNumericOperation}`
            : aggregation.fromField,
        ),
    ),
  );

  return z
    .object({
      groupBy: z
        .array(groupByEntrySchema)
        .min(1)
        .max(2)
        .describe(
          `Fields to group by (max 2). Each entry must be an object with exactly one field key. Examples: {"status": true}, {"companyId": true}, {"createdAt": {"granularity": "MONTH", "timeZone": "UTC"}}. Available: ${fieldNameDescriptions.join(', ')}.`,
        ),
      aggregateOperation: z
        .enum(Object.keys(AggregateOperations) as [string, ...string[]])
        .default(AggregateOperations.COUNT)
        .describe(
          'Aggregate operation to apply per group. Default: COUNT. Any operation other than COUNT requires aggregateFieldName.',
        ),
      aggregateFieldName: z
        .string()
        .optional()
        .describe(
          `Field to aggregate. Required for any operation other than COUNT. Available fields: ${availableAggregateFieldNames.join(', ')}.`,
        ),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .default(50)
        .describe(
          'Maximum number of groups to return (default: 50, max: 100).',
        ),
      orderBy: z
        .enum(['ASC', 'DESC'])
        .default('DESC')
        .describe(
          'Order groups by aggregate value. DESC (default) gives "top N" behavior.',
        ),
      ...filterShape,
      or: z
        .array(filterSchema)
        .optional()
        .describe('OR condition - matches if ANY of the filters match'),
      and: z
        .array(filterSchema)
        .optional()
        .describe('AND condition - matches if ALL filters match'),
      not: filterSchema
        .optional()
        .describe('NOT condition - matches if the filter does NOT match'),
    })
    .strict()
    .superRefine((input, context) => {
      const aggregateOperation =
        input.aggregateOperation as keyof typeof AggregateOperations;

      if (aggregateOperation === AggregateOperations.COUNT) {
        if (input.aggregateFieldName) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'aggregateFieldName is not supported for COUNT operation.',
            path: ['aggregateFieldName'],
          });
        }

        return;
      }

      if (!input.aggregateFieldName) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `aggregateFieldName is required for ${aggregateOperation} operation.`,
          path: ['aggregateFieldName'],
        });

        return;
      }

      const resolvedAggregateFieldKey = resolveAggregateFieldKey(
        aggregateOperation,
        input.aggregateFieldName,
        availableAggregations,
      );

      if (!resolvedAggregateFieldKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `No aggregation available for ${aggregateOperation} on field "${input.aggregateFieldName}".`,
          path: ['aggregateFieldName'],
        });
      }
    });
};
