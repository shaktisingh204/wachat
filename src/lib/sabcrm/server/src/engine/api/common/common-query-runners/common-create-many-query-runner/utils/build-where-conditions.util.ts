import { type ObjectRecord } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { type ConflictingFieldGroup } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/types/conflicting-field-group.type";
import { getValueFromPath } from "@/lib/sabcrm/server/src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util";

// PORT-NOTE: TypeORM FindOperator / In replaced with a plain Mongo-compatible
// { $in: values[] } structure. Callers that previously passed these conditions to
// a TypeORM query builder should adapt them to MongoDB $or / $in semantics.
export type InCondition = { $in: string[] };

export const buildWhereConditions = (
  records: Partial<ObjectRecord>[],
  conflictingFieldGroups: ConflictingFieldGroup[],
): Record<string, InCondition>[] => {
  const whereConditions: Record<string, InCondition>[] = [];

  for (const conflictingProperty of conflictingFieldGroups.flatMap(
    (group) => group.conflictingProperties,
  )) {
    const fieldValues = records
      .map((record) => getValueFromPath(record, conflictingProperty.fullPath))
      .filter(isDefined) as string[];

    if (fieldValues.length > 0) {
      whereConditions.push({
        [conflictingProperty.column]: { $in: fieldValues },
      });
    }
  }

  return whereConditions;
};
