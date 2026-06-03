import { FirstDayOfTheWeek } from '@/lib/sabcrm/shared/src/types/FirstDayOfTheWeek';
import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';
import { type FirstDayOfTheWeekSchema } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/firstDayOfWeekSchema';

export const getFirstDayOfTheWeekAsANumberForDateFNS = (
  firstDayOfTheWeek: FirstDayOfTheWeekSchema,
): 0 | 1 | 6 => {
  switch (firstDayOfTheWeek) {
    case FirstDayOfTheWeek.MONDAY:
      return 1;
    case FirstDayOfTheWeek.SATURDAY:
      return 6;
    case FirstDayOfTheWeek.SUNDAY:
      return 0;
    default:
      return assertUnreachable(firstDayOfTheWeek);
  }
};
