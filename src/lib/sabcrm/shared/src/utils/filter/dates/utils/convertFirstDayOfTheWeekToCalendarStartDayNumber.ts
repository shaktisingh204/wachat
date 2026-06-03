import { CalendarStartDay } from '@/lib/sabcrm/shared/src/constants/CalendarStartDay';
import { FirstDayOfTheWeek } from '@/lib/sabcrm/shared/src/types/FirstDayOfTheWeek';

export const convertFirstDayOfTheWeekToCalendarStartDayNumber = (
  firstDayOfTheWeek: FirstDayOfTheWeek,
): CalendarStartDay => {
  switch (firstDayOfTheWeek) {
    case FirstDayOfTheWeek.MONDAY:
      return CalendarStartDay.MONDAY;
    case FirstDayOfTheWeek.SATURDAY:
      return CalendarStartDay.SATURDAY;
    case FirstDayOfTheWeek.SUNDAY:
      return CalendarStartDay.SUNDAY;
  }
};
