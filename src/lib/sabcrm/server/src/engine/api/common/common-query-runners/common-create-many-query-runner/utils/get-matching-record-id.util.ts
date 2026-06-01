import { type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { type ConflictingFieldGroup } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/types/conflicting-field-group.type";
import { type PartialObjectRecordWithId } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/types/partial-object-record-with-id.type";
import { getValueFromPath } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util";
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception";

export const getMatchingRecordId = (
  record: Partial<ObjectRecord>,
  conflictingFieldGroups: ConflictingFieldGroup[],
  existingRecords: PartialObjectRecordWithId[],
): string | undefined => {
  const matchingRecordIds = conflictingFieldGroups.reduce<string[]>(
    (acc, fieldGroup) => {
      const requestFieldValues = fieldGroup.conflictingProperties.map(
        (conflictingProperty) => ({
          conflictingProperty,
          value: getValueFromPath(record, conflictingProperty.fullPath),
        }),
      );

      if (requestFieldValues.some(({ value }) => !isDefined(value))) {
        return acc;
      }

      const matchingRecord = existingRecords.find((existingRecord) =>
        requestFieldValues.every(({ conflictingProperty, value }) => {
          const existingFieldValue = getValueFromPath(
            existingRecord,
            conflictingProperty.fullPath,
          );

          return isDefined(existingFieldValue) && existingFieldValue === value;
        }),
      );

      if (isDefined(matchingRecord)) {
        acc.push(matchingRecord.id);
      }

      return acc;
    },
    [],
  );

  if ([...new Set(matchingRecordIds)].length > 1) {
    const conflictingFieldsValues = conflictingFieldGroups
      .flatMap((group) => group.conflictingProperties)
      .map((conflictingProperty) => {
        const value = getValueFromPath(record, conflictingProperty.fullPath);

        return isDefined(value)
          ? `${conflictingProperty.fullPath}: ${value}`
          : undefined;
      })
      .filter(isDefined)
      .join(", ");

    throw new CommonQueryRunnerException(
      `Multiple records found with the same unique field values for ${conflictingFieldsValues}. Cannot determine which record to update.`,
      CommonQueryRunnerExceptionCode.UPSERT_MULTIPLE_MATCHING_RECORDS_CONFLICT,
      {
        userFriendlyMessage: `Multiple records found with the same unique field values for ${conflictingFieldsValues}. Cannot determine which record to update.`,
      },
    );
  }

  return matchingRecordIds[0];
};
