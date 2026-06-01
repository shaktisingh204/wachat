import { transformNumericField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-numeric-field.util';
import { transformTextField } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util';

export const transformAddressField = (
  value: {
    addressStreet1?: string | null;
    addressStreet2?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostcode?: string | null;
    addressCountry?: string | null;
    addressLat?: number | null;
    addressLng?: number | null;
  } | null,
): {
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  addressCountry?: string | null;
  addressLat?: number | null;
  addressLng?: number | null;
} | null => {
  if (value === null) return null;

  return {
    addressStreet1:
      value.addressStreet1 === undefined
        ? undefined
        : transformTextField(value.addressStreet1),
    addressStreet2:
      value.addressStreet2 === undefined
        ? undefined
        : transformTextField(value.addressStreet2),
    addressCity:
      value.addressCity === undefined
        ? undefined
        : transformTextField(value.addressCity),
    addressState:
      value.addressState === undefined
        ? undefined
        : transformTextField(value.addressState),
    addressPostcode:
      value.addressPostcode === undefined
        ? undefined
        : transformTextField(value.addressPostcode),
    addressCountry:
      value.addressCountry === undefined
        ? undefined
        : transformTextField(value.addressCountry),
    addressLat:
      value.addressLat === undefined
        ? undefined
        : transformNumericField(value.addressLat),
    addressLng:
      value.addressLng === undefined
        ? undefined
        : transformNumericField(value.addressLng),
  };
};
