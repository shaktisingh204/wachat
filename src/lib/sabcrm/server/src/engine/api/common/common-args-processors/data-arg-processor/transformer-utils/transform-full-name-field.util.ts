import { transformTextField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util';

export const transformFullNameField = (
  value: {
    firstName?: string | null;
    lastName?: string | null;
  } | null,
): {
  firstName?: string | null;
  lastName?: string | null;
} | null => {
  if (value === null) return null;

  return {
    firstName:
      value.firstName === undefined
        ? undefined
        : transformTextField(value.firstName),
    lastName:
      value.lastName === undefined
        ? undefined
        : transformTextField(value.lastName),
  };
};
