/**
 * Returns true if the ISO date string represents a date-only value (no time component).
 * Example: "2024-01-15" → true, "2024-01-15T10:00:00Z" → false.
 */
export const isDateWithoutTime = (isoDateString: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDateString);
};
