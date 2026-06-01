// Transforms a phones composite field value — validates and normalises phone metadata.
// PORT-NOTE: libphonenumber-js is kept as a direct dependency. @lingui/core msg tags are
// replaced with plain strings. twenty-shared helpers inlined.

import {
  type CountryCallingCode,
  parsePhoneNumberWithError,
} from "libphonenumber-js";

import {
  RecordTransformerException,
  RecordTransformerExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/record-transformer/utils/remove-empty-links";

// ---- inline helpers ----

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isEmpty(value: unknown[] | null | undefined): boolean {
  return !value || value.length === 0;
}

// Simplified country-code validation using libphonenumber-js
function isValidCountryCode(code: string): boolean {
  // libphonenumber uses 2-letter ISO codes; basic check
  return /^[A-Z]{2}$/.test(code);
}

function getCountryCodesForCallingCode(callingCode: string): string[] {
  // PORT-NOTE: twenty-shared/utils.getCountryCodesForCallingCode inlined minimally.
  // Returns an array — if empty, calling code is invalid.
  // We use libphonenumber-js to parse a dummy number and extract the country.
  try {
    const withoutPlus = callingCode.replace(/\+/g, "");
    const phone = parsePhoneNumberWithError(`+${withoutPlus}000000000`);
    return phone.country ? [phone.country] : [];
  } catch {
    return [];
  }
}

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

// ---- types ----

export type AdditionalPhoneMetadata = {
  number: string;
  countryCode?: string;
  callingCode?: string;
};

export type PhonesFieldGraphQLInput =
  | {
      primaryPhoneNumber?: string | null;
      primaryPhoneCountryCode?: string | null;
      primaryPhoneCallingCode?: string | null;
      additionalPhones?: string | Partial<AdditionalPhoneMetadata>[] | null;
    }
  | null
  | undefined;

type AdditionalPhoneMetadataWithNumber = Partial<AdditionalPhoneMetadata> &
  Required<Pick<AdditionalPhoneMetadata, "number">>;

// ---- private helpers ----

const removePlusFromString = (str: string) => str.replace(/\+/g, "");

const nullIfEmptyString = (value: string | null | undefined) =>
  !isDefined(value) ? value : isNonEmptyString(value) ? value : null;

const validatePrimaryPhoneCountryCodeAndCallingCode = ({
  callingCode,
  countryCode,
}: {
  callingCode?: string | null;
  countryCode?: string | null;
}) => {
  if (isNonEmptyString(countryCode) && !isValidCountryCode(countryCode)) {
    throw new RecordTransformerException(
      `Invalid country code ${countryCode}`,
      RecordTransformerExceptionCode.INVALID_PHONE_COUNTRY_CODE,
    );
  }

  if (!isNonEmptyString(callingCode)) {
    return;
  }

  const expectedCountryCodes = getCountryCodesForCallingCode(callingCode);

  if (expectedCountryCodes.length === 0) {
    throw new RecordTransformerException(
      `Invalid calling code ${callingCode}`,
      RecordTransformerExceptionCode.INVALID_PHONE_CALLING_CODE,
    );
  }

  if (
    isNonEmptyString(countryCode) &&
    expectedCountryCodes.every(
      (expectedCountryCode) => expectedCountryCode !== countryCode,
    )
  ) {
    throw new RecordTransformerException(
      `Provided country code and calling code are conflicting`,
      RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE,
    );
  }
};

const parsePhoneNumberExceptionWrapper = ({
  callingCode,
  countryCode,
  number,
}: AdditionalPhoneMetadataWithNumber) => {
  try {
    return parsePhoneNumberWithError(number, {
      defaultCallingCode: callingCode
        ? removePlusFromString(callingCode)
        : callingCode,
      defaultCountry: countryCode as Parameters<
        typeof parsePhoneNumberWithError
      >[1] extends { defaultCountry?: infer C }
        ? C
        : never,
    });
  } catch {
    throw new RecordTransformerException(
      `Provided phone number is invalid ${number}`,
      RecordTransformerExceptionCode.INVALID_PHONE_NUMBER,
    );
  }
};

const validateAndInferMetadataFromPrimaryPhoneNumber = ({
  callingCode,
  countryCode,
  number,
}: AdditionalPhoneMetadataWithNumber): Partial<AdditionalPhoneMetadata> => {
  const phone = parsePhoneNumberExceptionWrapper({
    callingCode,
    countryCode,
    number,
  });

  if (
    isNonEmptyString(phone.country) &&
    isNonEmptyString(countryCode) &&
    phone.country !== countryCode
  ) {
    throw new RecordTransformerException(
      "Provided and inferred country code are conflicting",
      RecordTransformerExceptionCode.CONFLICTING_PHONE_COUNTRY_CODE,
    );
  }

  if (
    isNonEmptyString(phone.countryCallingCode) &&
    isNonEmptyString(callingCode) &&
    phone.countryCallingCode !== removePlusFromString(callingCode)
  ) {
    throw new RecordTransformerException(
      "Provided and inferred calling code are conflicting",
      RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE,
    );
  }

  const finalPrimaryPhoneCallingCode =
    callingCode ??
    (`+${phone.countryCallingCode}` as undefined | CountryCallingCode);
  const finalPrimaryPhoneCountryCode = countryCode ?? phone.country;

  return {
    countryCode: finalPrimaryPhoneCountryCode,
    callingCode: finalPrimaryPhoneCallingCode as string | undefined,
    number: phone.nationalNumber,
  };
};

const validateAndInferPhoneInput = ({
  callingCode,
  countryCode,
  number,
}: {
  callingCode?: string | null;
  countryCode?: string | null;
  number?: string | null;
}): Partial<AdditionalPhoneMetadata> & {
  number?: string | null;
  callingCode?: string | null;
  countryCode?: string | null;
} => {
  validatePrimaryPhoneCountryCodeAndCallingCode({ callingCode, countryCode });

  if (isNonEmptyString(number)) {
    return validateAndInferMetadataFromPrimaryPhoneNumber({
      number,
      callingCode: isNonEmptyString(callingCode) ? callingCode : undefined,
      countryCode:
        isNonEmptyString(countryCode) && isValidCountryCode(countryCode)
          ? countryCode
          : undefined,
    });
  }

  return {
    callingCode: nullIfEmptyString(callingCode),
    countryCode: nullIfEmptyString(countryCode),
    number: nullIfEmptyString(number),
  };
};

type TransformPhonesValueArgs = {
  input: PhonesFieldGraphQLInput;
};

export const transformPhonesValue = ({
  input,
}: TransformPhonesValueArgs): PhonesFieldGraphQLInput => {
  if (!isDefined(input)) {
    return input;
  }

  const { additionalPhones, ...primary } = input;
  const {
    callingCode: primaryPhoneCallingCode,
    countryCode: primaryPhoneCountryCode,
    number: primaryPhoneNumber,
  } = validateAndInferPhoneInput({
    callingCode: primary.primaryPhoneCallingCode,
    countryCode: primary.primaryPhoneCountryCode,
    number: primary.primaryPhoneNumber,
  });

  const parsedAdditionalPhones = isNonEmptyString(additionalPhones)
    ? (parseJson<Partial<AdditionalPhoneMetadata>[]>(additionalPhones) ?? [])
    : Array.isArray(additionalPhones)
      ? (additionalPhones as Partial<AdditionalPhoneMetadata>[])
      : [];

  const validatedAdditionalPhones = parsedAdditionalPhones.map(
    validateAndInferPhoneInput,
  );

  return removeUndefinedFields({
    additionalPhones: isEmpty(validatedAdditionalPhones)
      ? null
      : JSON.stringify(validatedAdditionalPhones),
    primaryPhoneCallingCode,
    primaryPhoneCountryCode,
    primaryPhoneNumber,
  } as Record<string, unknown>) as PhonesFieldGraphQLInput;
};
