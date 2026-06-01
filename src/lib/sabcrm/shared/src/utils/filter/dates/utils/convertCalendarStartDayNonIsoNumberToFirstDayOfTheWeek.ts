import { CalendarStartDay } from '@/lib/sabcrm/shared/src/constants/CalendarStartDay';
import { FirstDayOfTheWeek } from '@/lib/sabcrm/shared/src/types/FirstDayOfTheWeek';
import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';

export const convertCalendarStartDayNonIsoNumberToFirstDayOfTheWeek = (
  calendarStartDayNonIsoNumber: CalendarStartDay,
  systemCalendarStartDay: FirstDayOfTheWeek,
): FirstDayOfTheWeek => {
  switch (calendarStartDayNonIsoNumber) {
    case CalendarStartDay.MONDAY:
      return FirstDayOfTheWeek.MONDAY;
    case CalendarStartDay.SATURDAY:
      return FirstDayOfTheWeek.SATURDAY;
    case CalendarStartDay.SUNDAY:
      return FirstDayOfTheWeek.SUNDAY;
    case CalendarStartDay.SYSTEM:
      return systemCalendarStartDay;
    default:
      return assertUnreachable(calendarStartDayNonIsoNumber);
  }
};
