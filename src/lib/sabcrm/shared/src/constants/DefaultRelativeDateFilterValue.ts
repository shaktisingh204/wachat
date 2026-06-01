// PORT-NOTE: RelativeDateFilter is defined in utils/filter/dates/utils/relativeDateFilterSchema.ts (zod schema).
// Inlined here until the utils module is ported.
type RelativeDateFilterDirection = 'THIS' | 'PAST' | 'NEXT';
type RelativeDateFilterUnit =
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

type RelativeDateFilter = {
  direction: RelativeDateFilterDirection;
  unit: RelativeDateFilterUnit;
  amount?: number | null;
  timezone?: string | null;
  firstDayOfTheWeek?: number | null;
};

export const DEFAULT_RELATIVE_DATE_FILTER_VALUE: RelativeDateFilter = {
  direction: 'THIS',
  unit: 'DAY',
  amount: 1,
};
