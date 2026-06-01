import { Temporal } from 'temporal-polyfill';

/**
 * Parses a date string into a Temporal.PlainDate.
 * Accepts both ISO 8601 instant strings (e.g. "2024-01-15T00:00:00Z") and
 * plain date strings (e.g. "2024-01-15"). Throws if neither parse succeeds.
 */
export const parseToPlainDateOrThrow = (stringDate: string): Temporal.PlainDate => {
  try {
    const parsedPlainDate = Temporal.Instant.from(stringDate)
      .toZonedDateTimeISO('UTC')
      .toPlainDate();

    return parsedPlainDate;
  } catch {
    // fall through to next attempt
  }

  try {
    const parsedPlainDate = Temporal.PlainDate.from(stringDate);

    return parsedPlainDate;
  } catch {
    // fall through to throw
  }

  throw new Error(`Cannot parse date string as PlainDate : "${stringDate}"`);
};
