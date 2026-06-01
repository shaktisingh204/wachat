import { transformNumericField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-numeric-field.util';
import { transformTextField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util';

export const transformCurrencyField = (
  value: {
    amountMicros?: number | string | null;
    currencyCode?: string | null;
  } | null,
): {
  amountMicros?: number | null;
  currencyCode?: string | null;
} | null => {
  if (value === null) return null;

  return {
    amountMicros:
      value.amountMicros === undefined
        ? undefined
        : transformNumericField(value.amountMicros),
    currencyCode:
      value.currencyCode === undefined
        ? undefined
        : transformTextField(value.currencyCode),
  };
};
