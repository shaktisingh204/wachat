import { relativeDateFilterStringifiedSchema } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/relativeDateFilterStringifiedSchema';
import { resolveRelativeDateFilter } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/resolveRelativeDateFilter';
import { isNonEmptyString } from '@sniptt/guards';
import { Temporal } from 'temporal-polyfill';

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== null && value !== undefined;

export const resolveRelativeDateFilterStringified = (
  relativeDateFilterStringified?: string | null,
) => {
  if (!isNonEmptyString(relativeDateFilterStringified)) {
    return null;
  }

  const relativeDateFilterParseResult =
    relativeDateFilterStringifiedSchema.safeParse(
      relativeDateFilterStringified,
    );

  if (!relativeDateFilterParseResult.success) {
    return null;
  }

  const relativeDateFilter = relativeDateFilterParseResult.data;

  const referenceTodayZonedDateTime = isDefined(relativeDateFilter.timezone)
    ? Temporal.Now.zonedDateTimeISO(relativeDateFilter.timezone)
    : Temporal.Now.zonedDateTimeISO();

  const relativeDateFilterWithDateRange = resolveRelativeDateFilter(
    relativeDateFilter,
    referenceTodayZonedDateTime,
  );

  return relativeDateFilterWithDateRange;
};
