// PORT-NOTE: AggregateOperations from twenty-shared/types is re-declared here as
// a plain enum. AggregationField type is inlined since its source module
// (workspace-schema-builder) is a GraphQL-only concern with no Mongo analogue.

export enum AggregateOperations {
  COUNT = 'COUNT',
  COUNT_EMPTY = 'COUNT_EMPTY',
  COUNT_NOT_EMPTY = 'COUNT_NOT_EMPTY',
  COUNT_UNIQUE_VALUES = 'COUNT_UNIQUE_VALUES',
  COUNT_TRUE = 'COUNT_TRUE',
  COUNT_FALSE = 'COUNT_FALSE',
  SUM = 'SUM',
  AVERAGE = 'AVERAGE',
  MIN = 'MIN',
  MAX = 'MAX',
  EARLIEST = 'EARLIEST',
  LATEST = 'LATEST',
  PERCENT_EMPTY = 'PERCENT_EMPTY',
  PERCENT_NOT_EMPTY = 'PERCENT_NOT_EMPTY',
}

export type AggregationField = {
  aggregateOperation: AggregateOperations;
  fromField: string;
  subFieldForNumericOperation?: string;
};

export const resolveAggregateFieldKey = (
  aggregateOperation: keyof typeof AggregateOperations,
  aggregateFieldName: string,
  availableAggregations: Record<string, AggregationField>,
): string | null => {
  // Tool inputs use (aggregateOperation, aggregateFieldName), while GraphQL/REST
  // already pass concrete aggregate keys (e.g. "sumEmployees"), so this helper
  // intentionally adapts only the tool-surface contract.
  const fieldPathParts = aggregateFieldName.split('.');

  if (
    fieldPathParts.length > 2 ||
    fieldPathParts.some((fieldPathPart) => fieldPathPart.length === 0)
  ) {
    return null;
  }

  const [parentField, subField] = fieldPathParts;

  const targetOperation = AggregateOperations[aggregateOperation];

  const matchingEntry = Object.entries(availableAggregations).find(
    ([, aggregation]) => {
      if (aggregation.aggregateOperation !== targetOperation) {
        return false;
      }

      if (aggregation.fromField !== parentField) {
        return false;
      }

      if (subField) {
        return aggregation.subFieldForNumericOperation === subField;
      }

      return true;
    },
  );

  return matchingEntry?.[0] ?? null;
};
