import { type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { type ConflictingFieldGroup } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/types/conflicting-field-group.type";
import { type PartialObjectRecordWithId } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/types/partial-object-record-with-id.type";
import { getMatchingRecordId } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-matching-record-id.util";

export const categorizeRecords = (
  records: Partial<ObjectRecord>[],
  conflictingFieldGroups: ConflictingFieldGroup[],
  existingRecords: PartialObjectRecordWithId[],
): {
  recordsToUpdate: PartialObjectRecordWithId[];
  recordsToInsert: Partial<ObjectRecord>[];
} => {
  const recordsToUpdate: PartialObjectRecordWithId[] = [];
  const recordsToInsert: Partial<ObjectRecord>[] = [];

  for (const record of records) {
    const matchingRecordId = getMatchingRecordId(
      record,
      conflictingFieldGroups,
      existingRecords,
    );

    if (isDefined(matchingRecordId)) {
      recordsToUpdate.push({ ...record, id: matchingRecordId });
    } else {
      recordsToInsert.push(record);
    }
  }

  return { recordsToUpdate, recordsToInsert };
};
