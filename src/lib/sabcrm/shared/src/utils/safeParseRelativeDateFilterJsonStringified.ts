import {
  relativeDateFilterSchema,
  type RelativeDateFilter,
} from '@/lib/sabcrm/shared/src/utils/filter/dates/utils/relativeDateFilterSchema';

export const safeParseRelativeDateFilterJsonStringified = (
  value: string,
): RelativeDateFilter | undefined => {
  try {
    const parsedJson = JSON.parse(value);

    const result = relativeDateFilterSchema.safeParse(parsedJson);

    if (result.success) {
      return result.data;
    }

    return undefined;
  } catch {
    return undefined;
  }
};
