import { relativeDateFilterStringifiedSchema } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/relativeDateFilterStringifiedSchema';
import { resolveRelativeDateTimeFilter } from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/resolveRelativeDateTimeFilter';
import { isNonEmptyString } from '@sniptt/guards';
import { Temporal } from 'temporal-polyfill';

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== null && value !== undefined;

export const resolveRelativeDateTimeFilterStringified = (
  relativeDateTimeFilterStringified: string | null | undefined,
) => {
  if (!isNonEmptyString(relativeDateTimeFilterStringified)) {
    return null;
  }

  const relativeDateFilterParseResult =
    relativeDateFilterStringifiedSchema.safeParse(
      relativeDateTimeFilterStringified,
    );

  if (relativeDateFilterParseResult.success) {
    const relativeDateFilter = relativeDateFilterParseResult.data;

    const referenceTodayZonedDateTime = isDefined(relativeDateFilter.timezone)
      ? Temporal.Now.zonedDateTimeISO(relativeDateFilter.timezone)
      : Temporal.Now.zonedDateTimeISO();

    const relativeDateFilterWithDateRange = resolveRelativeDateTimeFilter(
      relativeDateFilter,
      referenceTodayZonedDateTime.round({ smallestUnit: 'second' }),
    );

    return relativeDateFilterWithDateRange;
  } else {
    return null;
  }
};
