import { type Nullable } from '@/lib/sabcrm/shared/src/types/Nullable';
import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';
import { type DateTimePeriod } from '@/lib/sabcrm/shared/src/utils/filter/dates/types/DateTimePeriod';
import { type FirstDayOfTheWeekSchema } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/firstDayOfWeekSchema';
import { getFirstDayOfTheWeekAsISONumber } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/getFirstDayOfTheWeekAsISONumber';
import { FIRST_DAY_OF_WEEK_ISO_8601_MONDAY } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/getNextPeriodStart';
import { type Temporal } from 'temporal-polyfill';

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== null && value !== undefined;

export const getPeriodStart = (
  dateTime: Temporal.ZonedDateTime,
  unit: DateTimePeriod,
  firstDayOfTheWeek?: Nullable<FirstDayOfTheWeekSchema>,
) => {
  switch (unit) {
    case 'DAY':
      return dateTime.startOfDay();
    case 'WEEK': {
      const firstDayOfTheWeekAsISONumber = isDefined(firstDayOfTheWeek)
        ? getFirstDayOfTheWeekAsISONumber(firstDayOfTheWeek)
        : FIRST_DAY_OF_WEEK_ISO_8601_MONDAY;

      const daysOffsetToSutract =
        (dateTime.dayOfWeek - firstDayOfTheWeekAsISONumber + 7) % 7;

      return dateTime.startOfDay().subtract({ days: daysOffsetToSutract });
    }
    case 'QUARTER': {
      const firstMonthOfTheQuarter = Math.floor((dateTime.month - 1) / 3);

      return dateTime
        .startOfDay()
        .with({ day: 1, month: firstMonthOfTheQuarter * 3 + 1 });
    }
    case 'MONTH':
      return dateTime.startOfDay().with({ day: 1 });
    case 'YEAR':
      return dateTime.startOfDay().with({ day: 1, month: 1 });
    case 'SECOND':
      return dateTime.with({ nanosecond: 0, microsecond: 0, millisecond: 0 });
    case 'MINUTE':
      return dateTime.with({
        second: 0,
        nanosecond: 0,
        microsecond: 0,
        millisecond: 0,
      });
    case 'HOUR':
      return dateTime.with({
        minute: 0,
        second: 0,
        nanosecond: 0,
        microsecond: 0,
        millisecond: 0,
      });
    default:
      return assertUnreachable(unit);
  }
};
