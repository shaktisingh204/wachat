import { type RecordFilterValueDependencies } from '@/lib/sabcrm/shared/src/types/RecordFilterValueDependencies';
import { type RecordGqlOperationFilter } from '@/lib/sabcrm/shared/src/types/RecordGqlOperationFilter';
import {
  turnRecordFilterGroupsIntoGqlOperationFilter,
  type RecordFilter,
  type RecordFilterGroup,
} from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterGroupIntoGqlOperationFilter';
import {
  type FieldShared,
  turnRecordFilterIntoRecordGqlOperationFilter,
} from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterIntoGqlOperationFilter';
import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

export const computeRecordGqlOperationFilter = ({
  fieldMetadataItems,
  recordFilters,
  recordFilterGroups,
  filterValueDependencies,
}: {
  recordFilters: Omit<RecordFilter, 'id'>[];
  fieldMetadataItems: FieldShared[];
  recordFilterGroups: RecordFilterGroup[];
  filterValueDependencies: RecordFilterValueDependencies;
}): RecordGqlOperationFilter => {
  const fieldMetadataItemById = new Map(
    fieldMetadataItems.map((field) => [field.id, field]),
  );

  const regularRecordGqlOperationFilter: RecordGqlOperationFilter[] =
    recordFilters
      .filter((filter) => !isDefined(filter.recordFilterGroupId))
      .map((regularFilter) => {
        return turnRecordFilterIntoRecordGqlOperationFilter({
          recordFilter: regularFilter,
          fieldMetadataItemById,
          filterValueDependencies,
        });
      })
      .filter(isDefined);

  const outermostFilterGroupId = recordFilterGroups.find(
    (recordFilterGroup) => !recordFilterGroup.parentRecordFilterGroupId,
  )?.id;

  const advancedRecordGqlOperationFilter =
    turnRecordFilterGroupsIntoGqlOperationFilter({
      filterValueDependencies,
      filters: recordFilters,
      fieldMetadataItemById,
      recordFilterGroups,
      currentRecordFilterGroupId: outermostFilterGroupId,
    });

  const recordGqlOperationFilters = [
    ...regularRecordGqlOperationFilter,
    advancedRecordGqlOperationFilter,
  ].filter(isDefined);

  if (recordGqlOperationFilters.length === 0) {
    return {};
  }

  if (recordGqlOperationFilters.length === 1) {
    return recordGqlOperationFilters[0];
  }

  const recordGqlOperationFilter = {
    and: recordGqlOperationFilters,
  };

  return recordGqlOperationFilter;
};
