import "server-only";

// PORT-NOTE: Ported from Twenty's get-group-by-expression.util.ts.
// SQL expression generation logic is preserved faithfully.
// IANA_TIME_ZONES and GROUP_BY_DATE_GRANULARITY_THAT_REQUIRE_TIME_ZONE are from ported shared constants.
// assertUnreachable is from ported shared utils.
// isNonEmptyString replaces @sniptt/guards with a plain inline check.

import { ObjectRecordGroupByDateGranularity } from '@/lib/sabcrm/shared/src/types/ObjectRecordGroupByDateGranularity';
import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';
import { GROUP_BY_DATE_GRANULARITY_THAT_REQUIRE_TIME_ZONE } from '@/lib/sabcrm/shared/src/constants/GroupByDateGranularityThatRequireTimeZone';
import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { STANDARD_ERROR_MESSAGE } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/standard-error-message.constant';
import type { GroupByField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-field.types';
import { isGroupByDateField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/is-group-by-date-field.util';
import { isGroupByRelationField } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/utils/is-group-by-relation-field.util';

// PORT-NOTE: IANA_TIME_ZONES imported from ported shared constants.
import { IANA_TIME_ZONES } from '@/lib/sabcrm/shared/src/constants/IanaTimeZones';

const VALID_IANA_TIMEZONES = new Set(IANA_TIME_ZONES);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export const getGroupByExpression = ({
  groupByField,
  columnNameWithQuotes,
}: {
  groupByField: GroupByField;
  columnNameWithQuotes: string;
}): string => {
  if (
    !(isGroupByDateField(groupByField) || isGroupByRelationField(groupByField))
  ) {
    if ('shouldUnnest' in groupByField && groupByField.shouldUnnest) {
      return `UNNEST(CASE WHEN CARDINALITY(${columnNameWithQuotes}) > 0 THEN ${columnNameWithQuotes} ELSE ARRAY[${columnNameWithQuotes}[1]] END)`;
    }

    return columnNameWithQuotes;
  }

  const dateGranularity = groupByField.dateGranularity;

  if (!isDefined(dateGranularity)) {
    return columnNameWithQuotes;
  }

  const shouldUseTimeZone =
    GROUP_BY_DATE_GRANULARITY_THAT_REQUIRE_TIME_ZONE.includes(
      dateGranularity,
    ) && groupByField.fieldMetadata.type === FieldMetadataType.DATE_TIME;

  const timeZoneIsNotProvided = !isNonEmptyString(groupByField.timeZone);

  if (shouldUseTimeZone && timeZoneIsNotProvided) {
    throw new CommonQueryRunnerException(
      'Time zone should be specified for a group by date on Day, Week, Month, Quarter or Year',
      CommonQueryRunnerExceptionCode.MISSING_TIMEZONE_FOR_DATE_GROUP_BY,
      { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
    );
  }

  if (
    shouldUseTimeZone &&
    !timeZoneIsNotProvided &&
    !VALID_IANA_TIMEZONES.has(groupByField.timeZone!)
  ) {
    throw new CommonQueryRunnerException(
      `Invalid timezone: ${groupByField.timeZone}`,
      CommonQueryRunnerExceptionCode.INVALID_TIMEZONE,
      { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
    );
  }

  const timeZoneAsDateTruncParameter = shouldUseTimeZone
    ? `, '${groupByField.timeZone}'`
    : '';

  const timeZoneAsToCharParameter = shouldUseTimeZone
    ? ` AT TIME ZONE '${groupByField.timeZone}'`
    : '';

  switch (dateGranularity) {
    case ObjectRecordGroupByDateGranularity.NONE:
      return columnNameWithQuotes;
    case ObjectRecordGroupByDateGranularity.DAY_OF_THE_WEEK:
      return `TRIM(TO_CHAR(${columnNameWithQuotes}, 'TMDay'))`;
    case ObjectRecordGroupByDateGranularity.MONTH_OF_THE_YEAR:
      return `TRIM(TO_CHAR(${columnNameWithQuotes}, 'TMMonth'))`;
    case ObjectRecordGroupByDateGranularity.QUARTER_OF_THE_YEAR:
      return `TRIM(TO_CHAR(${columnNameWithQuotes}, '"Q"Q'))`;
    case ObjectRecordGroupByDateGranularity.WEEK: {
      const weekStartDay = groupByField.weekStartDay;
      let shiftedExpression = `DATE_TRUNC('week', ${columnNameWithQuotes}${timeZoneAsDateTruncParameter})`;

      if (isDefined(weekStartDay)) {
        if (weekStartDay === 'SUNDAY') {
          shiftedExpression = `(DATE_TRUNC('week', ${columnNameWithQuotes} + INTERVAL '1 day'${timeZoneAsDateTruncParameter}) - INTERVAL '1 day')`;
        } else if (weekStartDay === 'SATURDAY') {
          shiftedExpression = `(DATE_TRUNC('week', ${columnNameWithQuotes} + INTERVAL '2 days'${timeZoneAsDateTruncParameter}) - INTERVAL '2 days')`;
        }
      }

      return `TO_CHAR(${shiftedExpression}${timeZoneAsToCharParameter}, 'YYYY-MM-DD')`;
    }
    case ObjectRecordGroupByDateGranularity.DAY:
    case ObjectRecordGroupByDateGranularity.MONTH:
    case ObjectRecordGroupByDateGranularity.QUARTER:
    case ObjectRecordGroupByDateGranularity.YEAR:
      return `TO_CHAR(DATE_TRUNC('${dateGranularity}', ${columnNameWithQuotes}${timeZoneAsDateTruncParameter})${timeZoneAsToCharParameter}, 'YYYY-MM-DD')`;
    default:
      return assertUnreachable(dateGranularity);
  }
};
