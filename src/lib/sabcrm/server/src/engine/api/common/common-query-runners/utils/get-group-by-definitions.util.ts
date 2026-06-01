import "server-only";

// PORT-NOTE: Ported from Twenty's get-group-by-definitions.util.ts.
// formatColumnNamesFromCompositeFieldAndSubfields is not yet ported from twenty-orm.
// A local stub is provided below that maps field name + optional sub-field to a single column name.
// Replace with the ported twenty-orm utility when available.

import type { GroupByDefinition } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-definition.type';
import type { GroupByField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-field.types';
import { getGroupByExpression } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/get-group-by-expression.util';
import { isGroupByDateField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/is-group-by-date-field.util';
import { isGroupByRelationField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/is-group-by-relation-field.util';
import { formatColumnNameAsAlias } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/remove-quote.util';

// PORT-NOTE: Stub for formatColumnNamesFromCompositeFieldAndSubfields until twenty-orm is ported.
// Returns [fieldName] or [fieldName_subFieldName] as an array with one element.
const formatColumnNamesFromCompositeFieldAndSubfields = (
  fieldName: string,
  subFieldNames?: string[],
): string[] => {
  if (subFieldNames && subFieldNames.length > 0) {
    return [`${fieldName}_${subFieldNames[0]}`];
  }
  return [fieldName];
};

export const getGroupByDefinitions = ({
  groupByFields,
  objectMetadataNameSingular,
}: {
  groupByFields: GroupByField[];
  objectMetadataNameSingular: string;
}): GroupByDefinition[] => {
  return groupByFields.map((groupByField) => {
    let columnNameWithQuotes: string;

    if (isGroupByRelationField(groupByField)) {
      const joinAlias = groupByField.fieldMetadata.name;
      const nestedColumnName = formatColumnNamesFromCompositeFieldAndSubfields(
        groupByField.nestedFieldMetadata.name,
        groupByField.nestedSubFieldName
          ? [groupByField.nestedSubFieldName]
          : undefined,
      )[0];

      columnNameWithQuotes = `"${joinAlias}"."${nestedColumnName}"`;
    } else {
      const columnName = formatColumnNamesFromCompositeFieldAndSubfields(
        groupByField.fieldMetadata.name,
        groupByField.subFieldName ? [groupByField.subFieldName] : undefined,
      )[0];
      columnNameWithQuotes = `"${objectMetadataNameSingular}"."${columnName}"`;
    }

    const isGroupByDateFieldOrTargetField =
      isGroupByDateField(groupByField) ||
      (isGroupByRelationField(groupByField) && groupByField.dateGranularity);

    const alias =
      formatColumnNameAsAlias(columnNameWithQuotes) +
      (isGroupByDateFieldOrTargetField
        ? `_${groupByField.dateGranularity}`
        : '');

    return {
      columnNameWithQuotes,
      expression: getGroupByExpression({
        groupByField,
        columnNameWithQuotes,
      }),
      alias,
      dateGranularity: isGroupByDateFieldOrTargetField
        ? groupByField.dateGranularity
        : undefined,
    };
  });
};
