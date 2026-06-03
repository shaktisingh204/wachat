import { FirstDayOfTheWeek } from '@/lib/sabcrm/shared/src/types/FirstDayOfTheWeek';
import z from 'zod';

export const firstDayOfWeekSchema = z.enum([
  FirstDayOfTheWeek.MONDAY,
  FirstDayOfTheWeek.SATURDAY,
  FirstDayOfTheWeek.SUNDAY,
]);

export type FirstDayOfTheWeekSchema = z.infer<typeof firstDayOfWeekSchema>;
