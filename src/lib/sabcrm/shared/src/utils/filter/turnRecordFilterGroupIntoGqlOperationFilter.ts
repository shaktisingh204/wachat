import { type CompositeFieldSubFieldName } from '@/lib/sabcrm/shared/src/types/CompositeFieldSubFieldNameType';
import { type FilterableAndTSVectorFieldType } from '@/lib/sabcrm/shared/src/types/FilterableFieldType';
import { RecordFilterGroupLogicalOperator } from '@/lib/sabcrm/shared/src/types/RecordFilterGroupLogicalOperator';
import { type RecordFilterValueDependencies } from '@/lib/sabcrm/shared/src/types/RecordFilterValueDependencies';
import { type RecordGqlOperationFilter } from '@/lib/sabcrm/shared/src/types/RecordGqlOperationFilter';
import { type ViewFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';

import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';
import {
  type FieldShared,
  turnRecordFilterIntoRecordGqlOperationFilter,
} from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterIntoGqlOperationFilter';

export type RecordFilter = {
  id: string;
  fieldMetadataId: string;
  value: string;
  type: FilterableAndTSVectorFieldType;
  recordFilterGroupId?: string | null;
  operand: ViewFilterOperand;
  subFieldName?: CompositeFieldSubFieldName | null | undefined;
  relationTargetFieldMetadataId?: string | null | undefined;
};

export type RecordFilterGroup = {
  id: string;
  parentRecordFilterGroupId?: string | null;
  logicalOperator: RecordFilterGroupLogicalOperator;
};

export const turnRecordFilterGroupsIntoGqlOperationFilter = ({
  filterValueDependencies,
  filters,
  fieldMetadataItemById,
  recordFilterGroups,
  currentRecordFilterGroupId,
}: {
  filterValueDependencies: RecordFilterValueDependencies;
  filters: Omit<RecordFilter, 'id'>[];
  fieldMetadataItemById: Map<string, FieldShared>;
  recordFilterGroups: RecordFilterGroup[];
  currentRecordFilterGroupId?: string;
}): RecordGqlOperationFilter | undefined => {
  const currentRecordFilterGroup = recordFilterGroups.find(
    (recordFilterGroup) => recordFilterGroup.id === currentRecordFilterGroupId,
  );

  if (!isDefined(currentRecordFilterGroup)) {
    return;
  }

  const recordFiltersInGroup = filters.filter(
    (filter) => filter.recordFilterGroupId === currentRecordFilterGroupId,
  );

  const groupRecordGqlOperationFilters = recordFiltersInGroup
    .map((recordFilter) =>
      turnRecordFilterIntoRecordGqlOperationFilter({
        filterValueDependencies,
        recordFilter: recordFilter,
        fieldMetadataItemById,
      }),
    )
    .filter(isDefined);

  const subGroupRecordGqlOperationFilters = recordFilterGroups
    .filter(
      (recordFilterGroup) =>
        recordFilterGroup.parentRecordFilterGroupId ===
        currentRecordFilterGroupId,
    )
    .map((subRecordFilterGroup) =>
      turnRecordFilterGroupsIntoGqlOperationFilter({
        filterValueDependencies,
        filters,
        fieldMetadataItemById,
        recordFilterGroups,
        currentRecordFilterGroupId: subRecordFilterGroup.id,
      }),
    )
    .filter(isDefined);

  if (
    currentRecordFilterGroup.logicalOperator ===
    RecordFilterGroupLogicalOperator.AND
  ) {
    return {
      and: [
        ...groupRecordGqlOperationFilters,
        ...subGroupRecordGqlOperationFilters,
      ],
    };
  } else if (
    currentRecordFilterGroup.logicalOperator ===
    RecordFilterGroupLogicalOperator.OR
  ) {
    return {
      or: [
        ...groupRecordGqlOperationFilters,
        ...subGroupRecordGqlOperationFilters,
      ],
    };
  } else {
    throw new Error(
      `Unknown logical operator ${currentRecordFilterGroup.logicalOperator}`,
    );
  }
};
